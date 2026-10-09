'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { createDb, installShim } from '../lib/adapter';
import { MARKUP } from '../lib/markup';

/** Confere se o e-mail logado está na lista liberada (tabela allowed_users). */
async function liberado(sb) {
  const { data, error } = await sb.rpc('is_allowed');
  return !error && data === true;
}

export default function Page() {
  const [estado, setEstado] = useState('carregando');   // carregando | login | negado | app | erro
  const [erro, setErro] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);

  // 1) sessão existente
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const sb = getSupabase();
        const { data } = await sb.auth.getSession();
        if (!vivo) return;
        if (!data.session) return setEstado('login');
        setEstado((await liberado(sb)) ? 'app' : 'negado');
      } catch (e) { if (vivo) { setErro(e.message); setEstado('erro'); } }
    })();
    return () => { vivo = false; };
  }, []);

  // 2) com o login feito e a marcação na tela, liga o app (uma única vez)
  useEffect(() => {
    if (estado !== 'app' || window.__escalasIniciado) return;
    window.__escalasIniciado = true;
    const sb = getSupabase();
    installShim(createDb(sb));
    const s = document.createElement('script');
    s.src = '/app.js';
    document.body.appendChild(s);
    const sair = document.getElementById('btn-sair');
    if (sair) sair.onclick = async () => { await sb.auth.signOut(); window.location.reload(); };
  }, [estado]);

  async function entrar(e) {
    e.preventDefault();
    setErro(''); setEntrando(true);
    try {
      const sb = getSupabase();
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) { setErro('E-mail ou senha incorretos.'); return; }
      setEstado((await liberado(sb)) ? 'app' : 'negado');
    } catch (err) { setErro(err.message); } finally { setEntrando(false); }
  }

  async function sair() {
    await getSupabase().auth.signOut();
    window.location.reload();
  }

  if (estado === 'app') return <div dangerouslySetInnerHTML={{ __html: MARKUP }} />;

  const caixa = { maxWidth: 380, margin: '12vh auto 0' };
  return (
    <main style={caixa}>
      <div className="brand" style={{ marginBottom: 18 }}>
        <div className="brand-mark" aria-hidden="true">E</div>
        <div><h1>Gestão de Escalas</h1><small>Acesso restrito à gestão</small></div>
      </div>

      {estado === 'carregando' && <p className="hint">Carregando…</p>}

      {estado === 'erro' && (
        <div className="banner feriado">Não foi possível iniciar: {erro}</div>
      )}

      {estado === 'login' && (
        <form className="card" onSubmit={entrar}>
          <div className="f"><label htmlFor="lg-email">E-mail</label>
            <input id="lg-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="f"><label htmlFor="lg-senha">Senha</label>
            <input id="lg-senha" type="password" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)} /></div>
          {erro && <div className="banner feriado" role="alert">{erro}</div>}
          <button className="btn primary" type="submit" disabled={entrando} style={{ width: '100%', justifyContent: 'center' }}>
            {entrando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      )}

      {estado === 'negado' && (
        <div className="card">
          <div className="banner feriado">Este e-mail não está liberado para usar o app.</div>
          <p className="hint">Peça a quem administra o sistema para incluir o seu e-mail na lista de acesso.</p>
          <button className="btn" onClick={sair}>Sair</button>
        </div>
      )}
    </main>
  );
}
