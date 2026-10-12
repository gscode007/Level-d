// Deterministic, serializable Firestore-shaped test adapter. No production import.
const clone = value => structuredClone(value);
const compare = (a, b) => a === b ? 0 : a < b ? -1 : 1;
class Snapshot {
  constructor(path, value) { this.id = path.split('/').at(-1); this.exists = value !== undefined; this.value = value; }
  data() { return this.exists ? clone(this.value) : undefined; }
}
class Query {
  constructor(db, path, filters = [], orders = [], take = Infinity, cursor = null) { Object.assign(this, { db, path, filters, orders, take, cursor }); }
  where(field, op, value) { return new Query(this.db, this.path, [...this.filters, [field, op, value]], this.orders, this.take, this.cursor); }
  orderBy(field, direction = 'asc') { return new Query(this.db, this.path, this.filters, [...this.orders, [field, direction]], this.take, this.cursor); }
  limit(take) { return new Query(this.db, this.path, this.filters, this.orders, take, this.cursor); }
  startAfter(...cursor) { return new Query(this.db, this.path, this.filters, this.orders, this.take, cursor); }
  doc(id) { return new Reference(this.db, `${this.path}/${id}`); }
  async get() {
    const prefix = `${this.path}/`;
    const orders = this.orders.length ? this.orders : [['__name__', 'asc']];
    const value = (doc, field) => field === '__name__' ? doc.id : doc.value[field];
    let docs = [...this.db.values].filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/')).map(([path, val]) => new Snapshot(path, val));
    docs = docs.filter(doc => this.filters.every(([field, op, expected]) => {
      const actual = value(doc, field);
      return op === '==' ? actual === expected : op === 'array-contains' ? actual.includes(expected) : op === '>=' ? actual >= expected : op === '<=' ? actual <= expected : op === '<' ? actual < expected : false;
    }));
    docs.sort((a, b) => { for (const [field, direction] of orders) { const result = compare(value(a, field), value(b, field)) * (direction === 'desc' ? -1 : 1); if (result) return result; } return 0; });
    if (this.cursor) docs = docs.filter(doc => { for (let i = 0; i < orders.length; i++) { const [field, direction] = orders[i]; const result = compare(value(doc, field), this.cursor[i]) * (direction === 'desc' ? -1 : 1); if (result) return result > 0; } return false; });
    docs = docs.slice(0, this.take); return { docs, empty: !docs.length, size: docs.length };
  }
}
class Reference {
  constructor(db, path) { this.db = db; this.path = path; this.id = path.split('/').at(-1); }
  collection(name) { return new Query(this.db, `${this.path}/${name}`); }
  async get() { return new Snapshot(this.path, this.db.values.get(this.path)); }
  async set(value) { this.db.values.set(this.path, clone(value)); }
}
export class MemoryStore {
  constructor() { this.values = new Map(); this.queue = Promise.resolve(); }
  collection(name) { return new Query(this, name); }
  async runTransaction(fn) {
    const run = this.queue.then(async () => {
      const writes = [];
      const result = await fn({
        get: async ref => { if (writes.length) throw new Error('Firestore requires all reads before writes.'); return ref.get(); },
        set: (ref, value) => writes.push([ref.path, clone(value), false]),
        update: (ref, value) => writes.push([ref.path, clone(value), true]),
      });
      for (const [path, value, merge] of writes) this.values.set(path, merge ? { ...this.values.get(path), ...value } : value);
      return result;
    });
    this.queue = run.catch(() => {}); return run;
  }
}
