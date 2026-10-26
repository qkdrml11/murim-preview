// 아주 작은 이벤트 버스 + 시스템 등록소.
// 새 시스템(속가·출정·외교·진영·무림대회·대 잇기)은 registerSystem({id, init, on:{event:fn}})으로 붙이면 돼요.
export function createBus() {
  const map = new Map();
  return {
    on(ev, fn) { if (!map.has(ev)) map.set(ev, []); map.get(ev).push(fn); return () => this.off(ev, fn); },
    off(ev, fn) { const a = map.get(ev); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
    emit(ev, payload) { const a = map.get(ev); if (a) for (const fn of [...a]) fn(payload); },
  };
}
export function createRegistry(bus) {
  const systems = [];
  return {
    systems,
    register(sys) {
      systems.push(sys);
      if (sys.on) for (const [ev, fn] of Object.entries(sys.on)) bus.on(ev, fn);
      return sys;
    },
    initAll(ctx) { for (const s of systems) if (s.init) s.init(ctx); },
    get(id) { return systems.find(s => s.id === id); },
  };
}
