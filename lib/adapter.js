/**
 * Camada de dados do app de escalas sobre o Supabase.
 *
 * O app guarda "documentos" em coleções (staff, extras, special, checkins, baixas, faltas, config).
 * Aqui cada documento é uma linha da tabela public.docs (collection, id, data jsonb).
 * As mudanças de outros aparelhos chegam por Realtime; uma releitura a cada 60 s e ao voltar
 * para a aba cobre qualquer evento perdido.
 */
export function createDb(supabase) {
  const cache = {};            // coleção -> { id: data }
  const subs = {};             // coleção -> Set de funções
  let started = null;

  const notify = c => (subs[c] ? [...subs[c]] : []).forEach(fn => fn());

  const snap = c => {
    const docs = Object.entries(cache[c] || {}).map(([id, d]) => ({ id, exists: true, data: () => d }));
    return { docs, size: docs.length, empty: docs.length === 0 };
  };
  const docSnap = (c, id) => {
    const d = (cache[c] || {})[id];
    return { id, exists: d !== undefined, data: () => d };
  };

  async function loadAll() {
    const out = {}, size = 1000;
    for (let from = 0; ; from += size) {
      const { data, error } = await supabase.from('docs').select('collection,id,data')
        .order('collection').order('id').range(from, from + size - 1);
      if (error) throw error;
      data.forEach(r => { (out[r.collection] = out[r.collection] || {})[r.id] = r.data; });
      if (data.length < size) break;
    }
    return out;
  }

  /** Relê tudo e avisa só as coleções que mudaram. */
  async function refresh() {
    const fresh = await loadAll();
    const cols = new Set([...Object.keys(cache), ...Object.keys(fresh)]);
    cols.forEach(c => {
      const a = JSON.stringify(cache[c] || {}), b = JSON.stringify(fresh[c] || {});
      if (a !== b) { cache[c] = fresh[c] || {}; notify(c); }
    });
  }

  function start() {
    if (started) return started;
    started = (async () => {
      Object.assign(cache, await loadAll());
      supabase.channel('docs-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, p => {
          const row = p.eventType === 'DELETE' ? p.old : p.new;
          if (!row || !row.collection) return;
          const c = row.collection;
          cache[c] = cache[c] || {};
          if (p.eventType === 'DELETE') delete cache[c][row.id]; else cache[c][row.id] = row.data;
          notify(c);
        }).subscribe();
      setInterval(() => refresh().catch(() => { }), 60000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh().catch(() => { }); });
    })();
    return started;
  }

  function listen(c, deliver, error) {
    let live = true;
    const fn = () => { if (live) deliver(); };
    (subs[c] = subs[c] || new Set()).add(fn);
    start().then(fn).catch(e => error && error({ code: 'unavailable', message: e.message }));
    return () => { live = false; subs[c].delete(fn); };
  }

  async function write(c, id, op) {
    try { await op(); }
    catch (e) { await refresh().catch(() => { }); throw e; }
  }

  return {
    collection: c => ({
      onSnapshot: (next, error) => listen(c, () => next(snap(c)), error)
    }),
    doc: path => {
      const i = path.indexOf('/'), c = path.slice(0, i), id = path.slice(i + 1);
      return {
        onSnapshot: (next, error) => listen(c, () => next(docSnap(c, id)), error),
        set: async data => {
          cache[c] = cache[c] || {}; cache[c][id] = data; notify(c);           // aparece na hora
          await write(c, id, async () => {
            const { error } = await supabase.from('docs')
              .upsert({ collection: c, id, data, updated_at: new Date().toISOString() });
            if (error) throw error;
          });
        },
        delete: async () => {
          if (cache[c]) delete cache[c][id]; notify(c);
          await write(c, id, async () => {
            const { error } = await supabase.from('docs').delete().eq('collection', c).eq('id', id);
            if (error) throw error;
          });
        }
      };
    }
  };
}

/** Download de arquivo (CSV do relatório) pelo navegador. */
export const downloads = {
  async save({ filename, data }) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return { saved: true };
  }
};

/** O app procura seus serviços em window.claude.use(nome); aqui ele recebe o banco e o download. */
export function installShim(db) {
  window.claude = { use: async name => (name === 'db' ? db : name === 'downloads' ? downloads : null) };
}
