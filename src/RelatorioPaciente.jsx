import { useState, useRef, useLayoutEffect, useMemo, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

/* ----------------------------- DADOS DO PACIENTE ----------------------------- */
const PACIENTE = {
  nome: "Mariana Alves",
  idade: 34,
  objetivo: "Emagrecimento",
  data: "2026-11-06", // formato AAAA-MM-DD (campo de data)
  agua: { de: 54.2, para: 58.1 },
  visceral: { de: 8, para: 5 },
};

const OBJETIVOS = [
  "Emagrecimento",
  "Hipertrofia",
  "Saúde da Mulher",
  "Reeducação Alimentar",
  "Controle da Diabetes",
  "Controle da Hipertensão",
  "Saúde Intestinal",
];

const ROTULOS = ["Início", ...Array.from({ length: 11 }, (_, i) => `M${i + 1}`)]; // inicial + até 11 meses
const PESO_EXEMPLO = [95.0, 93.6, 92.0, 90.9, 90.1, 89.3, 88.7, 88.0, 87.4, 86.9, 86.4, 86.0];
const GORDURA_KG_EXEMPLO = [28.5, 27.4, 26.2, 25.1, 24.0, 22.9, 21.8, 20.7, 19.6, 18.5, 15.5, 12.6];
const virgula = (n) => n.toFixed(1).replace(".", ",");
const REGISTROS_EXEMPLO = PESO_EXEMPLO.map((p, i) => ({
  peso: virgula(p),
  gordura: virgula((GORDURA_KG_EXEMPLO[i] / p) * 100), // % de gordura
}));
const REGISTROS_VAZIOS = ROTULOS.map(() => ({ peso: "", gordura: "" }));

/* -------------------------------- UTILITARIOS -------------------------------- */
const f1 = (n) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dataBR = (iso) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("/") : "");
const sinal = (n) => (n >= 0 ? "+" : "−");
const num = (v, max) => {
  const n = parseFloat(String(v).replace(",", "."));
  return isFinite(n) && n > 0 && n < max ? n : null;
};
const marcarChaves = (arr) =>
  arr.map((d, k) => ({ ...d, chave: k === 0 || k === arr.length - 1 || k === Math.floor((arr.length - 1) / 2) }));
const plural = (n) => `${n} ${n === 1 ? "mês" : "meses"}`;

const faixaVisceral = (n) => (n <= 9 ? "Baixo Risco" : n <= 14 ? "Risco Moderado" : "Alto Risco");
const legendaAgua = (de, para) =>
  de == null || para == null ? "" : para > de ? "Hidratação Otimizada" : para === de ? "Hidratação estável" : "Atenção à hidratação";

/* ------------------------------- PERSISTENCIA ------------------------------- */
const CHAVE = "relatorio-nutri:v1";
const hojeISO = () => new Date().toLocaleDateString("en-CA"); // AAAA-MM-DD
const texto = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));

// valida e normaliza um objeto salvo; devolve null se o formato for inválido
function normalizar(d) {
  try {
    if (!d || typeof d !== "object" || !d.paciente || !Array.isArray(d.registros)) return null;
    const registros = ROTULOS.map((_, i) => ({
      peso: texto(d.registros[i] && d.registros[i].peso),
      gordura: texto(d.registros[i] && d.registros[i].gordura),
    }));
    const b = d.bio || {};
    return {
      paciente: {
        nome: texto(d.paciente.nome),
        idade: texto(d.paciente.idade),
        objetivo: OBJETIVOS.includes(d.paciente.objetivo) ? d.paciente.objetivo : OBJETIVOS[0],
        data: /^\d{4}-\d{2}-\d{2}$/.test(d.paciente.data) ? d.paciente.data : hojeISO(),
      },
      registros,
      bio: {
        visceralDe: texto(b.visceralDe),
        visceralPara: texto(b.visceralPara),
        aguaDe: texto(b.aguaDe),
        aguaPara: texto(b.aguaPara),
      },
      comentario: typeof d.comentario === "string" ? d.comentario : null,
      destaque: typeof d.destaque === "string" ? d.destaque : null,
    };
  } catch (e) {
    return null;
  }
}

function lerSalvo() {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    return bruto ? normalizar(JSON.parse(bruto)) : null;
  } catch (e) {
    return null; // armazenamento indisponível: segue com os dados de exemplo
  }
}

const slug = (t) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function gerarTextoAutomatico(serie, comp, objetivo) {
  if (serie.length < 2)
    return "Informe o peso inicial e ao menos um mês de acompanhamento para gerar a análise automática.";
  const ini = serie[0];
  const fim = serie[serie.length - 1];
  const dif = ini.peso - fim.peso;
  let t = `Em ${plural(fim.i - ini.i)} de acompanhamento, o paciente foi de ${f1(ini.peso)} kg para ${f1(fim.peso)} kg (${dif >= 0 ? "−" : "+"}${f1(Math.abs(dif))} kg). `;
  if (comp.length >= 2) {
    const a = comp[comp.length - 1];
    const r = comp[Math.max(0, comp.length - 3)];
    const g = a.magra - r.magra;
    t += `Nos últimos ${plural(a.i - r.i)}, o percentual de gordura passou de ${f1(r.pctGordura)}% para ${f1(a.pctGordura)}% e a massa livre de gordura variou ${sinal(g)}${f1(Math.abs(g))} kg (estimada). `;
  }
  t +=
    objetivo === "Emagrecimento"
      ? "Nessa etapa, o emagrecimento tende a ser mais lento, e o foco passa a ser preservar massa magra e manter a consistência do plano alimentar."
      : `Nessa etapa, o acompanhamento segue focado em ${objetivo.toLowerCase()}, com ajustes conforme a evolução e a adesão ao plano alimentar.`;
  return t;
}

const TEXTO_FISIOLOGICO =
  "Oscilações de água, menor gasto energético e mudanças na adesão ajudam a explicar isso.";

/* ---------------------------- BLOCO DE TEXTO EDITAVEL ---------------------------- */
function BlocoEditavel({ automatico, titulo, escuro = false, custom, setCustom }) {
  // custom === null -> usa o texto automatico
  const ref = useRef(null);
  const valor = custom ?? automatico;
  const editado = custom !== null;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [valor]);

  const btn = escuro
    ? "text-xs px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
    : "text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors";

  return (
    <div className="break-inside-avoid">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {titulo && (
            <h3 className={`text-sm font-semibold ${escuro ? "text-white" : "text-slate-900"}`}>{titulo}</h3>
          )}
          {editado && (
            <span className={`text-[11px] ${escuro ? "text-blue-300" : "text-blue-600"}`}>editado</span>
          )}
        </div>
        <div className="flex gap-1.5 print:hidden no-print">
          <button className={btn} onClick={() => ref.current && ref.current.focus()}>
            📝 Editar Comentário
          </button>
          <button className={btn} onClick={() => setCustom(null)} disabled={!editado} style={{ opacity: editado ? 1 : 0.45 }}>
            🔄 Restaurar Texto Automático
          </button>
        </div>
      </div>
      <textarea
        ref={ref}
        value={valor}
        onChange={(e) => setCustom(e.target.value)}
        rows={2}
        spellCheck={false}
        className={`w-full resize-none bg-transparent outline-none border-0 p-0 text-sm leading-relaxed rounded focus:ring-0 ${
          escuro ? "text-white" : "text-slate-700"
        }`}
        style={{ overflow: "hidden" }}
      />
    </div>
  );
}

/* ---------------------------------- METRICAS ---------------------------------- */
function CardMetrica({ rotulo, valor, detalhe }) {
  return (
    <div className="relative bg-white rounded-2xl border border-slate-200 overflow-hidden pl-6 pr-4 py-4 break-inside-avoid">
      <span className="absolute left-0 top-0 bottom-0 bg-blue-500" style={{ width: 6 }} />
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className="text-xl font-semibold text-slate-900 mt-1 tabular-nums">{valor}</p>
      <p className="text-xs text-blue-600 mt-0.5">{detalhe}</p>
    </div>
  );
}

/* ---------------------------------- GRAFICOS ---------------------------------- */
const PontoChave = (cor) =>
  function Ponto({ cx, cy, payload, index }) {
    if (!payload.chave || cx == null || cy == null) return <g key={index} />;
    return <circle key={index} cx={cx} cy={cy} r={4.5} fill="#ffffff" stroke={cor} strokeWidth={2} />;
  };

function Gradiente({ id, cor }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={cor} stopOpacity={0.32} />
      <stop offset="100%" stopColor="#ffffff" stopOpacity={1} />
    </linearGradient>
  );
}

const TooltipLimpo = ({ active, payload, label, unidade }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-sm">
      <p className="text-slate-500 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-slate-900 tabular-nums">
          {p.name}: <b>{f1(p.value)} {unidade}</b>
        </p>
      ))}
    </div>
  );
};

const eixoX = { axisLine: false, tickLine: false, tick: { fill: "#94a3b8", fontSize: 11 }, interval: 0 };
const eixoY = { axisLine: false, tickLine: false, tick: { fill: "#94a3b8", fontSize: 11 }, width: 34 };

function Vazio({ texto }) {
  return (
    <div className="h-full flex items-center justify-center text-xs text-slate-400 text-center px-6">{texto}</div>
  );
}

function CartaoGrafico({ titulo, subtitulo, children }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 break-inside-avoid">
      <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>
      <p className="text-xs text-slate-500 mb-2">{subtitulo}</p>
      <div style={{ width: "100%", height: 190 }}>{children}</div>
    </section>
  );
}

/* campo editavel discreto: sem borda ate passar o mouse ou focar */
const campo =
  "bg-transparent outline-none border-0 border-b border-dashed border-transparent hover:border-slate-300 focus:border-blue-400 rounded-none p-0 transition-colors";

/* ------------------------------------ APP ------------------------------------ */
export default function RelatorioPaciente() {
  const [salvo] = useState(lerSalvo);
  const [registros, setRegistros] = useState(salvo ? salvo.registros : REGISTROS_EXEMPLO);
  const [paciente, setPaciente] = useState(
    salvo ? salvo.paciente : { nome: PACIENTE.nome, idade: PACIENTE.idade, objetivo: PACIENTE.objetivo, data: PACIENTE.data }
  );
  const [comentario, setComentario] = useState(salvo ? salvo.comentario : null);
  const [destaque, setDestaque] = useState(salvo ? salvo.destaque : null);
  const [aviso, setAviso] = useState("");
  const inputArquivo = useRef(null);
  const [bio, setBio] = useState(
    salvo
      ? salvo.bio
      : {
          visceralDe: String(PACIENTE.visceral.de),
          visceralPara: String(PACIENTE.visceral.para),
          aguaDe: virgula(PACIENTE.agua.de),
          aguaPara: virgula(PACIENTE.agua.para),
        }
  );
  const editarBio = (campo) => (e) => setBio((b) => ({ ...b, [campo]: e.target.value }));
  const visDe = num(bio.visceralDe, 60);
  const visPara = num(bio.visceralPara, 60);
  const aguaDe = num(bio.aguaDe, 100);
  const aguaPara = num(bio.aguaPara, 100);
  // salvamento automático neste navegador
  const instantaneo = { versao: 1, paciente, registros, bio, comentario, destaque };
  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(instantaneo));
    } catch (e) {
      /* armazenamento indisponível: o salvamento em arquivo continua funcionando */
    }
  });

  const aplicar = (d) => {
    setPaciente(d.paciente);
    setRegistros(d.registros);
    setBio(d.bio);
    setComentario(d.comentario);
    setDestaque(d.destaque);
  };
  const novoPaciente = () => {
    if (!window.confirm("Iniciar um novo paciente? Os dados atuais da tela serão apagados (salve o arquivo antes, se precisar).")) return;
    aplicar({
      paciente: { nome: "", idade: "", objetivo: OBJETIVOS[0], data: hojeISO() },
      registros: REGISTROS_VAZIOS,
      bio: { visceralDe: "", visceralPara: "", aguaDe: "", aguaPara: "" },
      comentario: null,
      destaque: null,
    });
    setAviso("Novo paciente iniciado.");
  };
  const salvarArquivo = () => {
    const blob = new Blob([JSON.stringify(instantaneo, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paciente-${slug(paciente.nome) || "sem-nome"}-${paciente.data || hojeISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setAviso("Arquivo gerado. Confira a pasta de Downloads.");
  };
  const abrirArquivo = (e) => {
    const arq = e.target.files && e.target.files[0];
    e.target.value = ""; // permite reabrir o mesmo arquivo
    if (!arq) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        const d = normalizar(JSON.parse(String(leitor.result)));
        if (!d) throw new Error("formato");
        aplicar(d);
        setAviso(`Paciente carregado: ${d.paciente.nome || "sem nome"}.`);
      } catch (err) {
        setAviso("Não foi possível abrir: o arquivo não é um paciente salvo por este relatório.");
      }
    };
    leitor.onerror = () => setAviso("Não foi possível ler o arquivo.");
    leitor.readAsText(arq);
  };
  const atualizar = (campo) => (e) => setPaciente((p) => ({ ...p, [campo]: e.target.value }));
  const editarRegistro = (i, campo) => (e) =>
    setRegistros((r) => r.map((x, k) => (k === i ? { ...x, [campo]: e.target.value } : x)));

  // meses preenchidos (peso válido); o % de gordura é opcional
  const serie = useMemo(() => {
    const out = [];
    registros.forEach((r, i) => {
      const peso = num(r.peso, 400);
      if (peso == null) return;
      const pg = num(r.gordura, 80);
      const gordura = pg != null ? (peso * pg) / 100 : null;
      out.push({ i, mes: ROTULOS[i], peso, pctGordura: pg, gordura, magra: gordura != null ? +(peso - gordura).toFixed(1) : null });
    });
    return marcarChaves(out);
  }, [registros]);

  const comp = useMemo(() => serie.filter((d) => d.gordura != null), [serie]);
  const compGrafico = useMemo(() => marcarChaves(comp), [comp]);
  const atualC = comp[comp.length - 1];
  const refC = comp.length >= 2 ? comp[Math.max(0, comp.length - 3)] : null;
  const mesesC = refC ? atualC.i - refC.i : 0;
  const ganhoMagra = refC ? atualC.magra - refC.magra : null;
  const textoAuto = useMemo(
    () => gerarTextoAutomatico(serie, comp, paciente.objetivo),
    [serie, comp, paciente.objetivo]
  );
  const ultimoMes = serie.length > 1 ? serie[serie.length - 1].i : 0;

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:py-0 print:bg-white">
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .folha { box-shadow: none !important; width: 100% !important; max-width: none !important; min-height: 0 !important; padding: 0 !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <main
        className="folha mx-auto bg-white shadow-sm rounded-2xl print:rounded-none px-4 sm:px-8 py-8"
        style={{ width: "100%", maxWidth: "210mm", minHeight: "297mm" }}
      >
        {/* 1. CABECALHO CLINICO */}
        <header className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <span>Acompanhamento Nutricional ·</span>
              <input
                type="date"
                value={paciente.data}
                onChange={atualizar("data")}
                aria-label="Data do relatório"
                className={`${campo} text-xs text-slate-500`}
              />
            </p>
            <input
              type="text"
              value={paciente.nome}
              onChange={atualizar("nome")}
              placeholder="Nome do paciente"
              aria-label="Nome do paciente"
              className={`${campo} w-full text-2xl font-semibold text-slate-900 mt-1`}
            />
            <p className="text-sm text-slate-600 mt-1 flex items-center gap-1.5 flex-wrap">
              <input
                type="number"
                min="0"
                max="120"
                value={paciente.idade}
                onChange={atualizar("idade")}
                aria-label="Idade"
                className={`${campo} w-12 text-sm text-slate-600 text-right`}
              />
              <span>anos · Objetivo:</span>
              <span className="relative inline-flex items-center">
                <select
                  value={paciente.objetivo}
                  onChange={atualizar("objetivo")}
                  aria-label="Objetivo"
                  className={`${campo} appearance-none pr-5 text-sm text-blue-600 font-medium cursor-pointer`}
                >
                  {OBJETIVOS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-0 text-[10px] text-blue-600 print:hidden no-print">▼</span>
              </span>
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="print:hidden no-print text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            Exportar Relatório (PDF)
          </button>
        </header>

        {/* PAINEL DE ENTRADA DE DADOS (não aparece na impressão) */}
        <section className="print:hidden no-print mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Dados de acompanhamento</h2>
              <p className="text-xs text-slate-500">
                Informe o peso inicial e até 11 meses, na ordem. Meses em branco são ignorados. O % de gordura é
                opcional e alimenta os cards e o gráfico de composição.
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button className="text-xs px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-100" onClick={() => setRegistros(REGISTROS_VAZIOS)}>
                Limpar
              </button>
              <button className="text-xs px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-100" onClick={() => setRegistros(REGISTROS_EXEMPLO)}>
                Exemplo
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <button className="text-xs px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white" onClick={salvarArquivo}>
              Salvar paciente (.json)
            </button>
            <button className="text-xs px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100" onClick={() => inputArquivo.current && inputArquivo.current.click()}>
              Abrir paciente
            </button>
            <button className="text-xs px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100" onClick={novoPaciente}>
              Novo paciente
            </button>
            <input ref={inputArquivo} type="file" accept=".json,application/json" className="hidden" onChange={abrirArquivo} />
            <span className="text-[11px] text-slate-400">
              {aviso || "Alterações são salvas automaticamente neste navegador."}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {registros.map((r, i) => (
              <div key={i} className="rounded-lg bg-white border border-slate-200 p-2">
                <p className="text-[11px] font-medium text-slate-600 mb-1">{i === 0 ? "Peso inicial" : `Mês ${i}`}</p>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={r.peso}
                    onChange={editarRegistro(i, "peso")}
                    placeholder="kg"
                    aria-label={`Peso ${i === 0 ? "inicial" : "do mês " + i} em kg`}
                    className="w-full min-w-0 text-sm border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={r.gordura}
                    onChange={editarRegistro(i, "gordura")}
                    placeholder="% gord."
                    aria-label={`Percentual de gordura ${i === 0 ? "inicial" : "do mês " + i}`}
                    className="w-full min-w-0 text-sm border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            ))}
          </div>
          <h3 className="text-xs font-semibold text-slate-900 mt-4 mb-2">Bioimpedância</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              ["visceralDe", "Gordura visceral inicial (nível)"],
              ["visceralPara", "Gordura visceral atual (nível)"],
              ["aguaDe", "Água corporal inicial (%)"],
              ["aguaPara", "Água corporal atual (%)"],
            ].map(([campoBio, rotulo]) => (
              <label key={campoBio} className="rounded-lg bg-white border border-slate-200 p-2 block">
                <span className="block text-[11px] font-medium text-slate-600 mb-1">{rotulo}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={bio[campoBio]}
                  onChange={editarBio(campoBio)}
                  className="w-full min-w-0 text-sm border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400"
                />
              </label>
            ))}
          </div>
        </section>

        {/* 2. METRICAS DE BIOIMPEDANCIA */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          <CardMetrica
            rotulo="Percentual de Gordura"
            valor={refC ? `${f1(refC.pctGordura)}% → ${f1(atualC.pctGordura)}%` : "—"}
            detalhe={refC ? `em ${plural(mesesC)}` : "informe o % de gordura"}
          />
          <CardMetrica
            rotulo="Massa Livre de Gordura (Massa Magra)"
            valor={refC ? `${sinal(ganhoMagra)}${f1(Math.abs(ganhoMagra))} kg` : "—"}
            detalhe={refC ? "estimada" : "informe o % de gordura"}
          />
          <CardMetrica
            rotulo="Água Corporal Total"
            valor={
              aguaPara == null ? "—" : aguaDe == null ? `${f1(aguaPara)}%` : `${f1(aguaDe)}% → ${f1(aguaPara)}%`
            }
            detalhe={aguaPara == null ? "informe a água corporal" : legendaAgua(aguaDe, aguaPara) || "valor atual"}
          />
          <CardMetrica
            rotulo="Gordura Visceral (Nível)"
            valor={
              visPara == null
                ? "—"
                : visDe == null
                ? `Nível ${Math.round(visPara)}`
                : `Nível ${Math.round(visDe)} → Nível ${Math.round(visPara)}`
            }
            detalhe={visPara == null ? "informe o nível visceral" : faixaVisceral(Math.round(visPara))}
          />
        </section>

        {/* 3. GRAFICOS */}
        <div className="grid gap-3 mt-5">
          <CartaoGrafico titulo="Evolução do Peso Corporal" subtitulo={`${ultimoMes} meses · kg`}>
            {serie.length < 2 ? <Vazio texto="Informe o peso inicial e ao menos um mês para ver a evolução." /> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <Gradiente id="gPeso" cor="#3b82f6" />
                </defs>
                <XAxis dataKey="mes" {...eixoX} />
                <YAxis {...eixoY} domain={["dataMin - 2", "dataMax + 2"]} tickFormatter={(v) => Math.round(v)} />
                <Tooltip content={<TooltipLimpo unidade="kg" />} />
                <Area
                  type="monotone"
                  dataKey="peso"
                  name="Peso"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fill="url(#gPeso)"
                  dot={PontoChave("#3b82f6")}
                  activeDot={{ r: 5, fill: "#fff", stroke: "#3b82f6", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </CartaoGrafico>

          <CartaoGrafico titulo="Composição Corporal" subtitulo="Gordura vs. massa magra · kg">
            {comp.length < 2 ? <Vazio texto="Informe o % de gordura em ao menos dois meses para ver a composição." /> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={compGrafico} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <Gradiente id="gMagra" cor="#1d4ed8" />
                  <Gradiente id="gGordura" cor="#60a5fa" />
                </defs>
                <XAxis dataKey="mes" {...eixoX} />
                <YAxis {...eixoY} domain={[0, "dataMax + 10"]} tickFormatter={(v) => Math.round(v)} />
                <Tooltip content={<TooltipLimpo unidade="kg" />} />
                <Area
                  type="monotone"
                  dataKey="magra"
                  name="Massa magra"
                  stroke="#1d4ed8"
                  strokeWidth={2.5}
                  fill="url(#gMagra)"
                  dot={PontoChave("#1d4ed8")}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="gordura"
                  name="Gordura"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fill="url(#gGordura)"
                  dot={PontoChave("#3b82f6")}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            )}
            <div className="flex gap-4 text-[11px] text-slate-500 justify-end -mt-1">
              <span><i className="inline-block w-2.5 h-2.5 rounded-full mr-1 align-middle" style={{ background: "#1d4ed8" }} />Massa magra</span>
              <span><i className="inline-block w-2.5 h-2.5 rounded-full mr-1 align-middle" style={{ background: "#3b82f6" }} />Gordura</span>
            </div>
          </CartaoGrafico>
        </div>

        {/* 4. ANALISE CLINICA HIBRIDA */}
        <section className="mt-5 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <BlocoEditavel titulo="Análise clínica" automatico={textoAuto} custom={comentario} setCustom={setComentario} />
          </div>
          <div className="bg-black text-white p-4 rounded-xl">
            <BlocoEditavel escuro automatico={TEXTO_FISIOLOGICO} custom={destaque} setCustom={setDestaque} />
          </div>
        </section>

        <footer className="mt-6 pt-3 border-t border-slate-200 text-[11px] text-slate-400 flex justify-between">
          <span>Valores de bioimpedância são estimativas e variam com hidratação e horário da medição.</span>
          <span>{dataBR(paciente.data)}</span>
        </footer>
      </main>
    </div>
  );
}
