import { useState, useRef, useLayoutEffect, useMemo, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

/* ----------------------------- DADOS DO PACIENTE ----------------------------- */
const PACIENTE = {
  nome: "Mariana Alves",
  idade: 34,
  objetivo: "Emagrecimento",
  sexo: "Feminino",
  altura: "165", // cm
  data: "2026-11-06", // formato AAAA-MM-DD (campo de data)
  agua: { de: 54.2, para: 58.1 },
  visceral: { de: 8, para: 5 },
};

const SEXOS = ["Feminino", "Masculino"];

const OBJETIVOS = [
  "Emagrecimento",
  "Hipertrofia",
  "Recomposição Corporal",
  "Saúde da Mulher",
  "Reeducação Alimentar",
  "Controle da Diabetes",
  "Controle da Hipertensão",
  "Saúde Intestinal",
];

const ROTULOS = ["Início", ...Array.from({ length: 11 }, (_, i) => `M${i + 1}`)]; // inicial + até 11 meses
const PESO_EXEMPLO = [95.0, 93.6, 92.0, 90.9, 90.1, 89.3, 88.7, 88.0, 87.4, 86.9, 86.4, 86.0];
const GORDURA_KG_EXEMPLO = [28.5, 27.4, 26.2, 25.1, 24.0, 22.9, 21.8, 20.7, 19.6, 18.5, 15.5, 12.6];
const MUSCULO_KG_EXEMPLO = [35.0, 35.0, 34.9, 35.0, 35.2, 35.4, 35.7, 36.0, 36.3, 36.6, 38.2, 40.0];
const virgula = (n) => n.toFixed(1).replace(".", ",");
const REGISTROS_EXEMPLO = PESO_EXEMPLO.map((p, i) => ({
  peso: virgula(p),
  gordura: virgula((GORDURA_KG_EXEMPLO[i] / p) * 100), // % de gordura
  musculo: virgula((MUSCULO_KG_EXEMPLO[i] / p) * 100), // % de musculatura
}));
// Tabela de composição corporal (valores e faixas vêm do aparelho de bioimpedância)
const COMPOSICAO_ITENS = ["Peso", "Massa gorda", "Massa óssea", "Massa proteica", "Água corporal", "Massa muscular", "Músculo esquelético"];
const COMPOSICAO_VAZIA = COMPOSICAO_ITENS.map(() => ({ med: "", min: "", max: "" }));
// exemplo fictício: Peso, Massa gorda e Massa muscular usam o último registro do acompanhamento quando a medição fica em branco
const COMPOSICAO_EXEMPLO = [
  { med: "", min: "50,4", max: "68,1" },
  { med: "", min: "9,0", max: "17,0" },
  { med: "2,9", min: "2,5", max: "3,3" },
  { med: "14,0", min: "11,0", max: "14,5" },
  { med: "50,0", min: "38,0", max: "46,5" },
  { med: "", min: "36,0", max: "44,0" },
  { med: "24,5", min: "22,0", max: "27,0" },
];
// Limites da taxa de gordura (início do Padrão, do Alto e do Muito alto), informados pelo aparelho para o sexo e a idade
const LIMITES_VAZIOS = { a: "", b: "", c: "" };
const LIMITES_EXEMPLO = { a: "10", b: "20", c: "30" };
const OUTROS_ITENS = [
  ["tmb", "Taxa metabólica basal (kcal)"],
  ["subcut", "Gordura subcutânea (%)"],
  ["asmi", "ASMI (kg/m²)"],
  ["idadeCorpo", "Idade do corpo (anos)"],
  ["whr", "WHR (cintura-quadril)"],
];
const OUTROS_VAZIO = { tmb: "", subcut: "", asmi: "", idadeCorpo: "", whr: "" };
const OUTROS_EXEMPLO = { tmb: "1520", subcut: "17,5", asmi: "6,8", idadeCorpo: "32", whr: "0,82" };
// Fase 3: gordura segmentar, equilíbrio muscular e impedância bioelétrica
const SEGMENTOS = ["Braço direito", "Braço esquerdo", "Tronco", "Perna direita", "Perna esquerda"];
const vazioSeg = () => SEGMENTOS.map(() => ({ kg: "", pct: "" }));
// faixas padrão do aparelho de referência (editáveis): gordura 80–160%; músculo: braços 80–115%, tronco e pernas 90–110%
const FAIXAS_PADRAO = { gMin: "80", gMax: "160", bMin: "80", bMax: "115", tMin: "90", tMax: "110" };
const SEG_VAZIO = { gordura: vazioSeg(), musculo: vazioSeg(), imp20: SEGMENTOS.map(() => ""), imp100: SEGMENTOS.map(() => ""), faixas: FAIXAS_PADRAO };
const SEG_EXEMPLO = {
  gordura: [{ kg: "1,1", pct: "128" }, { kg: "1,1", pct: "130" }, { kg: "8,2", pct: "140" }, { kg: "1,9", pct: "120" }, { kg: "1,9", pct: "118" }],
  musculo: [{ kg: "2,3", pct: "104" }, { kg: "2,3", pct: "105" }, { kg: "20,5", pct: "102" }, { kg: "7,2", pct: "100" }, { kg: "7,2", pct: "101" }],
  imp20: ["265,0", "262,3", "19,5", "254,1", "246,2"],
  imp100: ["232,0", "229,4", "15,0", "220,6", "213,3"],
  faixas: FAIXAS_PADRAO,
};
const REGISTROS_VAZIOS = ROTULOS.map(() => ({ peso: "", gordura: "", musculo: "" }));

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
      musculo: texto(d.registros[i] && d.registros[i].musculo),
    }));
    const b = d.bio || {};
    return {
      paciente: {
        nome: texto(d.paciente.nome),
        idade: texto(d.paciente.idade),
        objetivo: OBJETIVOS.includes(d.paciente.objetivo) ? d.paciente.objetivo : OBJETIVOS[0],
        sexo: SEXOS.includes(d.paciente.sexo) ? d.paciente.sexo : "",
        altura: texto(d.paciente.altura),
        data: /^\d{4}-\d{2}-\d{2}$/.test(d.paciente.data) ? d.paciente.data : hojeISO(),
      },
      registros,
      composicao: COMPOSICAO_ITENS.map((_, k) => {
        const c = (Array.isArray(d.composicao) && d.composicao[k]) || {};
        return { med: texto(c.med), min: texto(c.min), max: texto(c.max) };
      }),
      limGordura: { a: texto(d.limGordura && d.limGordura.a), b: texto(d.limGordura && d.limGordura.b), c: texto(d.limGordura && d.limGordura.c) },
      outros: Object.fromEntries(OUTROS_ITENS.map(([k]) => [k, texto(d.outros && d.outros[k])])),
      seg: {
        gordura: SEGMENTOS.map((_, k) => ({ kg: texto(d.seg && d.seg.gordura && d.seg.gordura[k] && d.seg.gordura[k].kg), pct: texto(d.seg && d.seg.gordura && d.seg.gordura[k] && d.seg.gordura[k].pct) })),
        musculo: SEGMENTOS.map((_, k) => ({ kg: texto(d.seg && d.seg.musculo && d.seg.musculo[k] && d.seg.musculo[k].kg), pct: texto(d.seg && d.seg.musculo && d.seg.musculo[k] && d.seg.musculo[k].pct) })),
        imp20: SEGMENTOS.map((_, k) => texto(d.seg && d.seg.imp20 && d.seg.imp20[k])),
        imp100: SEGMENTOS.map((_, k) => texto(d.seg && d.seg.imp100 && d.seg.imp100[k])),
        faixas: Object.fromEntries(Object.keys(FAIXAS_PADRAO).map((k) => [k, d.seg && d.seg.faixas && d.seg.faixas[k] != null ? texto(d.seg.faixas[k]) : FAIXAS_PADRAO[k]])),
      },
      pontuacao: texto(d.pontuacao),
      pesoAlvo: texto(d.pesoAlvo),
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

/* --------------------- IMPORTAÇÃO DE PDF E IMAGEM (leitura no próprio navegador) --------------------- */
const URL_PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
const URL_PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
const URL_TESSERACT = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

const carregarScript = (url, global) =>
  new Promise((ok, falha) => {
    if (window[global]) return ok();
    const sc = document.createElement("script");
    sc.src = url;
    sc.onload = ok;
    sc.onerror = () => falha(new Error("sem conexão para carregar o leitor (é preciso internet na primeira leitura)"));
    document.head.appendChild(sc);
  });

async function ocrImagem(origem, msg) {
  msg("Carregando leitor de imagem…");
  await carregarScript(URL_TESSERACT, "Tesseract");
  const r = await window.Tesseract.recognize(origem, "por", {
    logger: (m) => {
      if (m.status === "recognizing text") msg(`Reconhecendo texto… ${Math.round(m.progress * 100)}%`);
    },
  });
  return r.data.text;
}

async function imagemParaCanvas(arq) {
  const bmp = await createImageBitmap(arq);
  const esc = bmp.width < 2000 ? 2000 / bmp.width : 1;
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * esc);
  c.height = Math.round(bmp.height * esc);
  const ctx = c.getContext("2d");
  ctx.filter = "grayscale(1) contrast(1.15)";
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

async function extrairTexto(arq, msg) {
  const ehPdf = arq.type === "application/pdf" || /\.pdf$/i.test(arq.name);
  if (!ehPdf) return ocrImagem(await imagemParaCanvas(arq), msg);
  msg("Carregando leitor de PDF…");
  await carregarScript(URL_PDFJS, "pdfjsLib");
  const pdfjs = window.pdfjsLib;
  pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
    new Blob([`importScripts("${URL_PDFJS_WORKER}");`], { type: "text/javascript" })
  );
  const pdf = await pdfjs.getDocument({ data: await arq.arrayBuffer() }).promise;
  const paginas = Math.min(pdf.numPages, 3);
  let texto = "";
  for (let n = 1; n <= paginas; n++) {
    const pg = await pdf.getPage(n);
    const tc = await pg.getTextContent();
    const linhas = {};
    tc.items.forEach((it) => {
      const y = Math.round(it.transform[5] / 3);
      (linhas[y] = linhas[y] || []).push(it);
    });
    texto +=
      Object.keys(linhas).map(Number).sort((a, b) => b - a)
        .map((y) => linhas[y].sort((a, b) => a.transform[4] - b.transform[4]).map((i) => i.str).join(" "))
        .join("\n") + "\n";
  }
  if (texto.replace(/\s/g, "").length > 80) return texto; // PDF com texto: leitura direta, sem erro de OCR
  let ocr = ""; // PDF digitalizado (só imagem): lê cada página por OCR
  for (let n = 1; n <= paginas; n++) {
    const pg = await pdf.getPage(n);
    const vp = pg.getViewport({ scale: 2.2 });
    const c = document.createElement("canvas");
    c.width = vp.width;
    c.height = vp.height;
    await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    ocr += (await ocrImagem(c, msg)) + "\n";
  }
  return ocr;
}

// vírgula decimal e casas: a leitura por OCR às vezes perde o ponto ("829" em vez de "82,9")
const fixo = (tok) => {
  if (tok == null) return null;
  const t = String(tok).replace(",", ".");
  if (t.includes(".")) return parseFloat(t);
  return t.length >= 3 ? parseFloat(t.slice(0, -1) + "." + t.slice(-1)) : parseFloat(t);
};
const vir = (n, c = 1) => Number(n).toFixed(c).replace(".", ",");

function interpretar(bruto) {
  const t = bruto.replace(/[–—−]/g, "-");
  const r = { paciente: {}, comp: null, pesoAlvo: null, pontuacao: null, visceral: null, outros: {}, imp20: null, imp100: null, avisos: [] };
  const pega = (re) => {
    const m = t.match(re);
    return m ? m[1] : null;
  };
  const sexo = pega(/Sexo\s*[:：]?\s*(Masculino|Feminino)/i);
  if (sexo) r.paciente.sexo = /^m/i.test(sexo) ? "Masculino" : "Feminino";
  const idade = pega(/Idade\s*[:：]\s*(\d{1,3})/i);
  if (idade) r.paciente.idade = idade;
  const alt = pega(/Altura\s*[:：]?\s*(\d{2,3})\s*cm/i);
  if (alt) r.paciente.altura = alt;
  const dt = t.match(/teste\s*[:：]?\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  if (dt) r.paciente.data = `${dt[3]}-${dt[2]}-${dt[1]}`;

  // tabela de composição: as 7 primeiras linhas "medição (mín-máx)", na ordem do relatório
  const re = /(\d+[.,]?\d*)\s*\(\s*(\d+[.,]?\d*)\s*-\s*(\d+[.,]?\d*)\s*\)/g;
  const tri = [];
  let m;
  while ((m = re.exec(t)) && tri.length < 7) tri.push({ med: fixo(m[1]), min: fixo(m[2]), max: fixo(m[3]) });
  if (tri.length === 7 && tri.every((x) => x.med > 0 && x.min > 0 && x.max > x.min)) r.comp = tri;
  else r.avisos.push("Não consegui identificar a tabela de composição corporal (7 linhas com a faixa entre parênteses).");

  const alvo = pega(/Peso[-\s]*alvo[^\d]{0,40}(\d+[.,]?\d*)\s*kg/i);
  if (alvo) r.pesoAlvo = fixo(alvo);
  const pts = pega(/(\d{2,3})\s*\/\s*100\s*Pontos/i);
  if (pts) r.pontuacao = parseInt(pts, 10);
  const vis = pega(/gordura\s+visceral\D{0,6}(\d{1,2})(?!\d)/i);
  if (vis) r.visceral = parseInt(vis, 10);
  const tmb = pega(/basal\D{0,6}(\d{3,5})\s*kcal/i);
  if (tmb) r.outros.tmb = String(parseInt(tmb, 10));
  const sub = pega(/subcut\S*\D{0,4}(\d+[.,]?\d*)\s*%/i);
  if (sub) r.outros.subcut = vir(fixo(sub));
  const asmi = pega(/ASMI\D{0,4}(\d+[.,]\d+)/i);
  if (asmi) r.outros.asmi = vir(fixo(asmi));
  const ic = pega(/Idade\s+do\s+\S+\s+(\d{1,3})\b/i);
  if (ic) r.outros.idadeCorpo = ic;
  const whr = pega(/WHR\D{0,3}(\d+[.,]\d+)/i);
  if (whr) r.outros.whr = vir(fixo(whr), 2);
  const linhaImp = (khz) => {
    const x = t.match(new RegExp("\\b" + khz + "\\s*\\(?\\s*kHz\\s*\\)?\\s+((?:\\d+[.,]?\\d*\\s+){4}\\d+[.,]?\\d*)", "i"));
    return x ? x[1].trim().split(/\s+/).map(fixo) : null;
  };
  r.imp20 = linhaImp(20);
  r.imp100 = linhaImp(100);
  r.temDados = !!(r.comp || r.pesoAlvo || r.visceral != null || Object.keys(r.outros).length || r.imp20 || r.imp100 || Object.keys(r.paciente).length);
  return r;
}

// Classificação do IMC (OMS, adultos). Para menores de 18 e idosos os critérios são outros.
function classificarIMC(v, idade) {
  if (idade != null && idade < 18) return "avaliar por curvas de crescimento";
  if (idade != null && idade >= 60) return "avaliar com referência para idosos";
  if (v < 18.5) return "Baixo peso";
  if (v < 25) return "Peso normal";
  if (v < 30) return "Sobrepeso";
  if (v < 35) return "Obesidade grau I";
  if (v < 40) return "Obesidade grau II";
  return "Obesidade grau III";
}

// valor escrito sobre os pontos-chave do gráfico
const rotuloChave = (dados, cor) =>
  function Rotulo({ x, y, value, index }) {
    const d = dados[index];
    if (!d || !d.chave || x == null || y == null || value == null) return <g key={index} />;
    return (
      <text key={index} x={x} y={y} dy={-9} textAnchor="middle" fontSize={10} fontWeight={600} fill={cor}>
        {f1(value)}
      </text>
    );
  };

function gerarTextoAutomatico(serie, comp, objetivo, imc) {
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
  if (imc) t += `O IMC atual é ${f1(imc.atual)} kg/m² (${imc.classe}). `;
  const cm = serie.filter((d) => d.musculo != null);
  if (cm.length >= 2 && comp.length >= 2) {
    const am = cm[cm.length - 1];
    const rm = cm[Math.max(0, cm.length - 3)];
    const ag = comp[comp.length - 1];
    const rg = comp[Math.max(0, comp.length - 3)];
    const dg = ag.gordura - rg.gordura;
    const dm = am.musculo - rm.musculo;
    t += `Nos registros mais recentes, o peso de gordura corporal variou ${sinal(dg)}${f1(Math.abs(dg))} kg e o peso em músculo variou ${sinal(dm)}${f1(Math.abs(dm))} kg. `;
  }
  t +=
    objetivo === "Recomposição Corporal"
      ? "Na recomposição corporal, a evolução é lida pela troca entre gordura e músculo, e não apenas pelo peso na balança."
      : objetivo === "Emagrecimento"
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
    const ajustar = () => {
      const el = ref.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    };
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
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
        className={`no-print w-full resize-none bg-transparent outline-none border-0 p-0 text-sm leading-relaxed rounded focus:ring-0 ${
          escuro ? "text-white" : "text-slate-700"
        }`}
        style={{ overflow: "hidden" }}
      />
      {/* na impressão o texto é um parágrafo comum: a caixa tem exatamente a altura do texto */}
      <div className={`so-impressao whitespace-pre-wrap text-sm leading-relaxed ${escuro ? "text-white" : "text-slate-700"}`}>{valor}</div>
    </div>
  );
}

/* ---------------------------------- METRICAS ---------------------------------- */
function CardMetrica({ rotulo, valor, detalhe }) {
  return (
    <div className="relative bg-white rounded-2xl border border-slate-200 overflow-hidden pl-5 pr-3 py-3 break-inside-avoid">
      <span className="absolute left-0 top-0 bottom-0 bg-blue-500" style={{ width: 6 }} />
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className="text-lg font-semibold text-slate-900 mt-1 tabular-nums leading-tight">{valor}</p>
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

const CHIP = {
  "Padrão": "bg-blue-50 text-blue-700",
  Alto: "bg-amber-50 text-amber-700",
  Baixo: "bg-sky-50 text-sky-700",
};

function TabelaComposicao({ linhas }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-blue-500 text-white">
          <th className="text-left font-medium px-3 py-1.5 rounded-tl-lg"> </th>
          <th className="text-right font-medium px-3 py-1.5">Medição (kg)</th>
          <th className="text-right font-medium px-3 py-1.5">% do peso</th>
          <th className="text-right font-medium px-3 py-1.5 rounded-tr-lg">Avaliação</th>
        </tr>
      </thead>
      <tbody>
        {linhas.filter((l) => l.valor != null).map((l, k) => (
          <tr key={l.nome} className={k % 2 ? "bg-slate-50" : "bg-white"}>
            <td className="px-3 py-1.5 text-slate-700">{l.nome}</td>
            <td className="px-3 py-1.5 text-right text-slate-900 tabular-nums">
              {f1(l.valor)}
              {l.min != null && l.max != null && (
                <span className="text-slate-400"> ({f1(l.min)}–{f1(l.max)})</span>
              )}
            </td>
            <td className="px-3 py-1.5 text-right text-slate-700 tabular-nums">{l.prop != null ? f1(l.prop) : "—"}</td>
            <td className="px-3 py-1.5 text-right">
              {l.aval ? <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${CHIP[l.aval]}`}>{l.aval}</span> : <span className="text-slate-400">—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const FAIXAS = ["Fino", "Padrão", "Alto", "Muito alto"];

function BarraFaixa({ titulo, valor, limites }) {
  const idx = valor < limites[0] ? 0 : valor < limites[1] ? 1 : valor < limites[2] ? 2 : 3;
  return (
    <div>
      <p className="text-[11px] text-slate-600">{titulo}</p>
      <div className="relative mt-4">
        <span
          className="absolute -top-4 text-center text-[11px] font-semibold text-blue-600 tabular-nums"
          style={{ left: `${idx * 25}%`, width: "25%" }}
        >
          {f1(valor)}
        </span>
        <div className="flex gap-0.5">
          {FAIXAS.map((nome, k) => (
            <div key={nome} className={`flex-1 h-1.5 rounded ${k === idx ? "bg-blue-500" : "bg-slate-200"}`} />
          ))}
        </div>
        <div className="flex mt-1">
          {FAIXAS.map((nome, k) => (
            <span key={nome} className={`flex-1 text-center text-[9px] ${k === idx ? "text-blue-600 font-medium" : "text-slate-400"}`}>
              {nome}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// linhas: IMC (>= 25, 18,5 a 25, < 18,5); colunas: % de gordura (abaixo de a, entre a e b, a partir de b)
const MATRIZ_CORPO = [
  ["Atletas", "Gordura muscular", "Obesidade"],
  ["Músculo", "Ajuste", "Excesso"],
  ["Marasmo", "Fino", "Gordura invisível"],
];

function MatrizCorpo({ imc, gord, a, b }) {
  const lin = imc >= 25 ? 0 : imc >= 18.5 ? 1 : 2;
  const col = gord < a ? 0 : gord < b ? 1 : 2;
  return (
    <div>
      <div className="grid grid-cols-3 gap-0.5">
        {MATRIZ_CORPO.map((linha, r) =>
          linha.map((nome, c) => (
            <div
              key={nome}
              className={`flex items-center justify-center text-center rounded text-[9px] leading-tight px-0.5 h-9 ${
                r === lin && c === col ? "bg-blue-500 text-white font-semibold" : "bg-slate-100 text-slate-500"
              }`}
            >
              {nome}
            </div>
          ))
        )}
      </div>
      <p className="text-[9px] text-slate-400 mt-1 leading-snug">
        Linhas: IMC (acima de 25, de 18,5 a 25, abaixo de 18,5). Colunas: % de gordura (abaixo de {f1(a)}, de {f1(a)} a {f1(b)}, a partir de {f1(b)}).
      </p>
    </div>
  );
}

const COR_AVAL = { "Padrão": "#3b82f6", Alto: "#f59e0b", Baixo: "#7dd3fc", "": "#e2e8f0" };
const CAMPO_CLS = "w-full min-w-0 text-xs border border-slate-200 rounded-md px-1.5 py-1 bg-white outline-none focus:border-blue-400";

// fundo definido = rótulo escrito dentro do segmento (texto branco sobre azul, escuro sobre as demais cores)
function RotuloSeg({ x, y, ancora, it, fundo }) {
  if (!it || (it.kg == null && it.pct == null)) return null;
  const dentro = fundo !== undefined;
  const corTxt = dentro ? (fundo === "Padrão" ? "#ffffff" : "#1e293b") : "#334155";
  return (
    <text x={x} y={y} textAnchor={ancora} fontSize="10" fill={corTxt}>
      {it.kg != null && <tspan x={x} dy="0" fontWeight="600">{f1(it.kg)} kg</tspan>}
      {it.pct != null && <tspan x={x} dy="11">{f1(it.pct)}%</tspan>}
      {it.aval && <tspan x={x} dy="11" fill={dentro ? corTxt : it.aval === "Padrão" ? "#2563eb" : it.aval === "Alto" ? "#b45309" : "#0369a1"}>{it.aval}</tspan>}
    </text>
  );
}

// itens na ordem de SEGMENTOS: [braço direito, braço esquerdo, tronco, perna direita, perna esquerda]; L (esquerdo) fica à esquerda da figura, como no aparelho
function FiguraCorpo({ itens }) {
  const cor = (k) => COR_AVAL[(itens[k] && itens[k].aval) || ""];
  return (
    <svg viewBox="0 0 260 240" className="w-full mx-auto" style={{ maxWidth: 300 }} role="img" aria-label="Figura do corpo com cinco segmentos">
      <circle cx="130" cy="22" r="14" fill="#cbd5e1" />
      <rect x="104" y="44" width="52" height="84" rx="14" fill={cor(2)} />
      <rect x="80" y="48" width="18" height="82" rx="9" fill={cor(1)} />
      <rect x="162" y="48" width="18" height="82" rx="9" fill={cor(0)} />
      <rect x="106" y="134" width="22" height="100" rx="11" fill={cor(4)} />
      <rect x="132" y="134" width="22" height="100" rx="11" fill={cor(3)} />
      <text x="70" y="16" textAnchor="end" fontSize="10" fill="#94a3b8">L</text>
      <text x="190" y="16" fontSize="10" fill="#94a3b8">R</text>
      <RotuloSeg x={72} y={62} ancora="end" it={itens[1]} />
      <RotuloSeg x={130} y={78} ancora="middle" it={itens[2]} fundo={(itens[2] && itens[2].aval) || ""} />
      <RotuloSeg x={98} y={176} ancora="end" it={itens[4]} />
      <RotuloSeg x={188} y={62} ancora="start" it={itens[0]} />
      <RotuloSeg x={162} y={176} ancora="start" it={itens[3]} />
    </svg>
  );
}

function TabelaImpedancia({ imp20, imp100 }) {
  const fmt = (v) => (num(v, 100000) != null ? f1(num(v, 100000)) : "—");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-blue-500 text-white">
            <th className="text-left font-medium px-3 py-1.5 rounded-tl-lg">Z (Ω)</th>
            {SEGMENTOS.map((n, k) => (
              <th key={n} className={`text-right font-medium px-3 py-1.5 ${k === SEGMENTOS.length - 1 ? "rounded-tr-lg" : ""}`}>{n}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[["20 kHz", imp20], ["100 kHz", imp100]].map(([rot, vals], r) => (
            <tr key={rot} className={r % 2 ? "bg-slate-50" : "bg-white"}>
              <td className="px-3 py-1.5 text-slate-700">{rot}</td>
              {vals.map((v, k) => (
                <td key={k} className="px-3 py-1.5 text-right tabular-nums text-slate-900">{fmt(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CartaoGrafico({ titulo, subtitulo, children }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 break-inside-avoid">
      <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>
      <p className="text-xs text-slate-500 mb-2">{subtitulo}</p>
      <div className="w-full h-[190px] print:h-[150px]">{children}</div>
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
    salvo ? salvo.paciente : { nome: PACIENTE.nome, idade: PACIENTE.idade, sexo: PACIENTE.sexo, altura: PACIENTE.altura, objetivo: PACIENTE.objetivo, data: PACIENTE.data }
  );
  const [comentario, setComentario] = useState(salvo ? salvo.comentario : null);
  const [destaque, setDestaque] = useState(salvo ? salvo.destaque : null);
  const [composicao, setComposicao] = useState(salvo ? salvo.composicao : COMPOSICAO_EXEMPLO);
  const [pontuacao, setPontuacao] = useState(salvo ? salvo.pontuacao : "72");
  const [pesoAlvo, setPesoAlvo] = useState(salvo ? salvo.pesoAlvo : "65,0");
  const [limGordura, setLimGordura] = useState(salvo ? salvo.limGordura : LIMITES_EXEMPLO);
  const [outros, setOutros] = useState(salvo ? salvo.outros : OUTROS_EXEMPLO);
  const [seg, setSeg] = useState(salvo ? salvo.seg : SEG_EXEMPLO);
  const [importacao, setImportacao] = useState(null);
  const inputImport = useRef(null);
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
  const instantaneo = { versao: 1, paciente, registros, bio, comentario, destaque, composicao, pontuacao, pesoAlvo, limGordura, outros, seg };
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
    setComposicao(d.composicao);
    setPontuacao(d.pontuacao);
    setPesoAlvo(d.pesoAlvo);
    setLimGordura(d.limGordura);
    setOutros(d.outros);
    setSeg(d.seg);
  };
  const novoPaciente = () => {
    if (!window.confirm("Iniciar um novo paciente? Os dados atuais da tela serão apagados (salve o arquivo antes, se precisar).")) return;
    aplicar({
      paciente: { nome: "", idade: "", sexo: "", altura: "", objetivo: OBJETIVOS[0], data: hojeISO() },
      registros: REGISTROS_VAZIOS,
      bio: { visceralDe: "", visceralPara: "", aguaDe: "", aguaPara: "" },
      comentario: null,
      destaque: null,
      composicao: COMPOSICAO_VAZIA,
      pontuacao: "",
      pesoAlvo: "",
      limGordura: LIMITES_VAZIOS,
      outros: OUTROS_VAZIO,
      seg: SEG_VAZIO,
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
  const editarComp = (k, campo) => (e) =>
    setComposicao((c) => c.map((x, j) => (j === k ? { ...x, [campo]: e.target.value } : x)));
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
      const pm = num(r.musculo, 80);
      const musculo = pm != null ? (peso * pm) / 100 : null;
      out.push({ i, mes: ROTULOS[i], peso, pctGordura: pg, gordura, pctMusculo: pm, musculo, magra: gordura != null ? +(peso - gordura).toFixed(1) : null });
    });
    return marcarChaves(out);
  }, [registros]);

  const comp = useMemo(() => serie.filter((d) => d.gordura != null), [serie]);
  const compM = useMemo(() => serie.filter((d) => d.musculo != null), [serie]);
  const atualM = compM[compM.length - 1];
  const refM = compM.length >= 2 ? compM[Math.max(0, compM.length - 3)] : null;
  const mesesM = refM ? atualM.i - refM.i : 0;
  // gráfico de composição: gordura x músculo (se houver % de musculatura) ou gordura x massa magra
  const graf = useMemo(() => {
    const base = comp.filter((d) => d.musculo != null);
    return base.length >= 2 ? { usaMusculo: true, dados: marcarChaves(base) } : { usaMusculo: false, dados: marcarChaves(comp) };
  }, [comp]);
  const par = (a, b, chave, suf) => `${f1(a[chave])}${suf} → ${f1(b[chave])}${suf}`;
  const parKg = (a, b, chave) => `${f1(a[chave])} → ${f1(b[chave])} kg`;
  const difKg = (a, b, chave) => {
    const d = b[chave] - a[chave];
    return `${sinal(d)}${f1(Math.abs(d))} kg`;
  };
  const atualC = comp[comp.length - 1];
  const refC = comp.length >= 2 ? comp[Math.max(0, comp.length - 3)] : null;
  const mesesC = refC ? atualC.i - refC.i : 0;
  const ganhoMagra = refC ? atualC.magra - refC.magra : null;
  // tabela de composição: medição digitada (ou derivada do acompanhamento), proporção e avaliação pela faixa do aparelho
  const linhasComp = useMemo(() => {
    const ultimo = serie[serie.length - 1];
    const derivado = [ultimo ? ultimo.peso : null, atualC ? atualC.gordura : null, null, null, null, atualM ? atualM.musculo : null, null];
    const linhas = COMPOSICAO_ITENS.map((nome, k) => {
      const c = composicao[k];
      const valor = num(c.med, 1000) ?? derivado[k];
      const min = num(c.min, 1000);
      const max = num(c.max, 1000);
      const aval = valor == null || min == null || max == null ? "" : valor < min ? "Baixo" : valor > max ? "Alto" : "Padrão";
      return { nome, valor, min, max, aval, prop: null };
    });
    const pesoTab = linhas[0].valor;
    return linhas.map((l) => ({ ...l, prop: l.valor != null && pesoTab ? (l.valor / pesoTab) * 100 : null }));
  }, [composicao, serie, atualC, atualM]);
  const limA = num(limGordura.a, 100);
  const limB = num(limGordura.b, 100);
  const limC = num(limGordura.c, 100);
  const limOk = limA != null && limB != null && limC != null && limA < limB && limB < limC;
  const gordAtual = atualC ? atualC.pctGordura : null;
  const outrosPreenchidos = OUTROS_ITENS.filter(([k]) => num(outros[k], 100000) != null);
  const segItens = useMemo(() => {
    const n = (v) => num(v, 100000);
    const f = seg.faixas;
    const aval = (pct, mn, mx) => (pct == null || mn == null || mx == null ? "" : pct < mn ? "Baixo" : pct > mx ? "Alto" : "Padrão");
    const mk = (tipo) =>
      SEGMENTOS.map((nome, k) => {
        const kg = n(seg[tipo][k].kg);
        const pct = n(seg[tipo][k].pct);
        const [mn, mx] = tipo === "gordura" ? [n(f.gMin), n(f.gMax)] : k < 2 ? [n(f.bMin), n(f.bMax)] : [n(f.tMin), n(f.tMax)];
        return { nome, kg, pct, aval: aval(pct, mn, mx) };
      });
    return { gordura: mk("gordura"), musculo: mk("musculo") };
  }, [seg]);
  const temSegG = segItens.gordura.some((x) => x.kg != null || x.pct != null);
  const temSegM = segItens.musculo.some((x) => x.kg != null || x.pct != null);
  const temImp = [...seg.imp20, ...seg.imp100].some((v) => num(v, 100000) != null);
  const editarSeg = (tipo, k, campoS) => (e) =>
    setSeg((x) => ({ ...x, [tipo]: x[tipo].map((it, j) => (j === k ? { ...it, [campoS]: e.target.value } : it)) }));
  const editarImp = (tipo, k) => (e) => setSeg((x) => ({ ...x, [tipo]: x[tipo].map((v, j) => (j === k ? e.target.value : v)) }));
  const editarFaixa = (k) => (e) => setSeg((x) => ({ ...x, faixas: { ...x.faixas, [k]: e.target.value } }));

  const importarArquivo = async (e) => {
    const arq = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!arq) return;
    try {
      const texto = await extrairTexto(arq, setAviso);
      const r = interpretar(texto);
      if (!r.temDados) throw new Error("não encontrei dados de bioimpedância no arquivo");
      const vazio = registros.findIndex((x) => num(x.peso, 400) == null);
      setImportacao({ r, slot: vazio >= 0 ? vazio : registros.length - 1, texto });
      setAviso("");
    } catch (err) {
      setAviso("Não foi possível ler o arquivo: " + (err && err.message ? err.message : "erro desconhecido"));
    }
  };
  const aplicarImportacao = () => {
    const { r, slot } = importacao;
    setPaciente((p) => ({ ...p, ...r.paciente }));
    if (r.comp) {
      setComposicao(r.comp.map((c) => ({ med: vir(c.med), min: vir(c.min), max: vir(c.max) })));
      const [peso, gord, musc] = [r.comp[0].med, r.comp[1].med, r.comp[5].med];
      setRegistros((rs) => rs.map((x, i) => (i === slot ? { peso: vir(peso), gordura: vir((gord / peso) * 100), musculo: vir((musc / peso) * 100) } : x)));
    }
    if (r.pesoAlvo != null) setPesoAlvo(vir(r.pesoAlvo));
    if (r.pontuacao != null) setPontuacao(String(r.pontuacao));
    if (Object.keys(r.outros).length) setOutros((o) => ({ ...o, ...r.outros }));
    if (r.visceral != null) setBio((b) => ({ ...b, visceralPara: String(r.visceral) }));
    if (r.imp20 || r.imp100)
      setSeg((x) => ({ ...x, ...(r.imp20 ? { imp20: r.imp20.map((v) => vir(v)) } : {}), ...(r.imp100 ? { imp100: r.imp100.map((v) => vir(v)) } : {}) }));
    setImportacao(null);
    setAviso("Dados importados. Confira os campos e ajuste o que for preciso.");
  };
  const pontosNum = num(pontuacao, 201);
  const alvoNum = num(pesoAlvo, 400);
  const pesoAtualNum = serie.length ? serie[serie.length - 1].peso : null;
  const imcInfo = useMemo(() => {
    const h = num(paciente.altura, 230);
    if (h == null || h < 100 || serie.length === 0) return null;
    const m = h / 100;
    const at = serie[serie.length - 1];
    const rf = serie.length >= 2 ? serie[Math.max(0, serie.length - 3)] : null;
    const atual = at.peso / (m * m);
    return { atual, ref: rf ? rf.peso / (m * m) : null, classe: classificarIMC(atual, num(paciente.idade, 130)) };
  }, [serie, paciente.altura, paciente.idade]);
  const textoAuto = useMemo(
    () => gerarTextoAutomatico(serie, comp, paciente.objetivo, imcInfo),
    [serie, comp, paciente.objetivo, imcInfo]
  );
  const pesosV = serie.map((d) => d.peso);
  const faixaPeso = pesosV.length ? Math.max(...pesosV) - Math.min(...pesosV) : 0;
  const folgaPeso = faixaPeso < 5 ? 1 : 2; // poucos dados: eixo mais "apertado" e com casas decimais
  const casasPeso = faixaPeso < 5 ? 1 : 0;
  const ultimoMes = serie.length > 1 ? serie[serie.length - 1].i : 0;

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:py-0 print:bg-white">
      <style>{`
        .so-impressao { display: none; }
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { background: #fff !important; margin: 0 !important; }
          .no-print { display: none !important; }
          .so-impressao { display: block !important; }
          .quadro { break-inside: avoid; page-break-inside: avoid; }
          input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          input[type=number] { -moz-appearance: textfield; appearance: textfield; }
          input[type=date]::-webkit-calendar-picker-indicator { display: none; }
          .folha { box-shadow: none !important; width: 100% !important; max-width: none !important; min-height: 0 !important; padding: 10mm !important; }
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
              <span>anos ·</span>
              <select
                value={paciente.sexo}
                onChange={atualizar("sexo")}
                aria-label="Sexo"
                className={`${campo} appearance-none text-sm text-slate-600 cursor-pointer`}
              >
                <option value="">Sexo</option>
                {SEXOS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <span>·</span>
              <input
                type="number"
                min="100"
                max="230"
                value={paciente.altura}
                onChange={atualizar("altura")}
                placeholder="—"
                aria-label="Altura em centímetros"
                className={`${campo} w-12 text-sm text-slate-600 text-right`}
              />
              <span>cm · Objetivo:</span>
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
                Informe o peso inicial e até 11 meses, na ordem. Meses em branco são ignorados. O % de gordura e o % de musculatura são opcionais e alimentam os cards, o gráfico de composição e a análise.
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
            <button className="text-xs px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100" onClick={() => inputImport.current && inputImport.current.click()}>
              Importar PDF ou imagem
            </button>
            <input ref={inputArquivo} type="file" accept=".json,application/json" className="hidden" onChange={abrirArquivo} />
            <input ref={inputImport} type="file" accept="application/pdf,image/*" className="hidden" onChange={importarArquivo} />
            <span className="text-[11px] text-slate-400">
              {aviso || "Alterações são salvas automaticamente neste navegador."}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {registros.map((r, i) => (
              <div key={i} className="rounded-lg bg-white border border-slate-200 p-2">
                <p className="text-[11px] font-medium text-slate-600 mb-1">{i === 0 ? "Peso inicial" : `Mês ${i}`}</p>
                <div className="grid grid-cols-3 gap-1">
                  <input type="text" inputMode="decimal" value={r.peso} onChange={editarRegistro(i, "peso")} placeholder="kg"
                    aria-label={`Peso ${i === 0 ? "inicial" : "do mês " + i} em kg`} className="w-full min-w-0 text-xs border border-slate-200 rounded-md px-1.5 py-1 outline-none focus:border-blue-400" />
                  <input type="text" inputMode="decimal" value={r.gordura} onChange={editarRegistro(i, "gordura")} placeholder="% gord."
                    aria-label={`Percentual de gordura ${i === 0 ? "inicial" : "do mês " + i}`} className="w-full min-w-0 text-xs border border-slate-200 rounded-md px-1.5 py-1 outline-none focus:border-blue-400" />
                  <input type="text" inputMode="decimal" value={r.musculo} onChange={editarRegistro(i, "musculo")} placeholder="% músc."
                    aria-label={`Percentual de musculatura ${i === 0 ? "inicial" : "do mês " + i}`} className="w-full min-w-0 text-xs border border-slate-200 rounded-md px-1.5 py-1 outline-none focus:border-blue-400" />
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
          <h3 className="text-xs font-semibold text-slate-900 mt-4 mb-1">Composição corporal (valores do aparelho)</h3>
          <p className="text-[11px] text-slate-500 mb-2">
            Digite a medição atual e a faixa de referência (mín e máx) que o aparelho informa. A avaliação (Baixo, Padrão ou Alto) e o % do peso são calculados. Peso, Massa gorda e Massa muscular usam o último registro do acompanhamento quando ficam em branco.
          </p>
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-1.5 items-center text-[11px] text-slate-500 mb-1">
            <span />
            <span>Medição (kg)</span>
            <span>Faixa mín</span>
            <span>Faixa máx</span>
          </div>
          {COMPOSICAO_ITENS.map((nome, k) => (
            <div key={nome} className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-1.5 items-center mb-1">
              <span className="text-xs text-slate-700">{nome}</span>
              {["med", "min", "max"].map((campoC) => (
                <input
                  key={campoC}
                  type="text"
                  inputMode="decimal"
                  value={composicao[k][campoC]}
                  onChange={editarComp(k, campoC)}
                  aria-label={`${nome}: ${campoC === "med" ? "medição" : campoC === "min" ? "faixa mínima" : "faixa máxima"}`}
                  className="w-full min-w-0 text-xs border border-slate-200 rounded-md px-1.5 py-1 bg-white outline-none focus:border-blue-400"
                />
              ))}
            </div>
          ))}
          <h3 className="text-xs font-semibold text-slate-900 mt-4 mb-1">Avaliação da obesidade e tipo de corpo</h3>
          <p className="text-[11px] text-slate-500 mb-2">
            O IMC usa as faixas da OMS (altura e peso). Para a taxa de gordura, informe os três limites em % que o aparelho usa para o sexo e a idade do paciente: onde começam Padrão, Alto e Muito alto. A matriz de tipo de corpo usa os dois primeiros.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[["a", "Padrão a partir de (%)"], ["b", "Alto a partir de (%)"], ["c", "Muito alto a partir de (%)"]].map(([k, rotulo]) => (
              <label key={k} className="rounded-lg bg-white border border-slate-200 p-2 block">
                <span className="block text-[11px] font-medium text-slate-600 mb-1">{rotulo}</span>
                <input type="text" inputMode="decimal" value={limGordura[k]} onChange={(e) => setLimGordura((l) => ({ ...l, [k]: e.target.value }))} className="w-full min-w-0 text-sm border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400" />
              </label>
            ))}
          </div>
          <h3 className="text-xs font-semibold text-slate-900 mt-4 mb-2">Outros indicadores</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {OUTROS_ITENS.map(([k, rotulo]) => (
              <label key={k} className="rounded-lg bg-white border border-slate-200 p-2 block">
                <span className="block text-[11px] font-medium text-slate-600 mb-1">{rotulo}</span>
                <input type="text" inputMode="decimal" value={outros[k]} onChange={(e) => setOutros((o) => ({ ...o, [k]: e.target.value }))} className="w-full min-w-0 text-sm border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400" />
              </label>
            ))}
          </div>
          <details className="mt-4">
            <summary className="text-xs font-semibold text-slate-900 cursor-pointer">Gordura segmentar, equilíbrio muscular e impedância</summary>
            <p className="text-[11px] text-slate-500 my-2">
              Digite o peso (kg) e o % de cada segmento, como o aparelho informa. A avaliação usa as faixas abaixo (valores padrão do aparelho de referência; ajuste se o seu aparelho usar outras).
            </p>
            {[["gordura", "Gordura segmentar"], ["musculo", "Equilíbrio muscular"]].map(([tipo, titulo]) => (
              <div key={tipo} className="mb-3">
                <p className="text-[11px] font-medium text-slate-700 mb-1">{titulo}</p>
                {SEGMENTOS.map((nome, k) => (
                  <div key={nome} className="grid grid-cols-[1.4fr_1fr_1fr] gap-1.5 items-center mb-1">
                    <span className="text-xs text-slate-700">{nome}</span>
                    <input type="text" inputMode="decimal" placeholder="kg" value={seg[tipo][k].kg} onChange={editarSeg(tipo, k, "kg")} aria-label={`${titulo}, ${nome}, kg`} className={CAMPO_CLS} />
                    <input type="text" inputMode="decimal" placeholder="%" value={seg[tipo][k].pct} onChange={editarSeg(tipo, k, "pct")} aria-label={`${titulo}, ${nome}, porcentagem`} className={CAMPO_CLS} />
                  </div>
                ))}
              </div>
            ))}
            <p className="text-[11px] font-medium text-slate-700 mb-1">Faixas padrão (% de avaliação)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {[["gMin", "Gordura: mín"], ["gMax", "Gordura: máx"], ["bMin", "Músculo, braços: mín"], ["bMax", "Músculo, braços: máx"], ["tMin", "Músculo, tronco e pernas: mín"], ["tMax", "Músculo, tronco e pernas: máx"]].map(([k, rot]) => (
                <label key={k} className="block">
                  <span className="block text-[11px] text-slate-500 mb-0.5">{rot}</span>
                  <input type="text" inputMode="decimal" value={seg.faixas[k]} onChange={editarFaixa(k)} className={CAMPO_CLS} />
                </label>
              ))}
            </div>
            <p className="text-[11px] font-medium text-slate-700 mb-1">Impedância bioelétrica Z (Ω)</p>
            {[["imp20", "20 kHz"], ["imp100", "100 kHz"]].map(([tipo, rot]) => (
              <div key={tipo} className="mb-2">
                <p className="text-[11px] text-slate-500 mb-0.5">{rot}</p>
                <div className="grid grid-cols-5 gap-1">
                  {SEGMENTOS.map((nome, k) => (
                    <input key={nome} type="text" inputMode="decimal" placeholder={nome.replace("Braço", "Br.").replace("Perna", "Pe.")} value={seg[tipo][k]} onChange={editarImp(tipo, k)} aria-label={`Impedância ${rot}, ${nome}`} className={CAMPO_CLS} />
                  ))}
                </div>
              </div>
            ))}
          </details>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <label className="rounded-lg bg-white border border-slate-200 p-2 block">
              <span className="block text-[11px] font-medium text-slate-600 mb-1">Pontuação corporal do aparelho (opcional)</span>
              <input type="text" inputMode="decimal" value={pontuacao} onChange={(e) => setPontuacao(e.target.value)} className="w-full min-w-0 text-sm border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400" />
            </label>
            <label className="rounded-lg bg-white border border-slate-200 p-2 block">
              <span className="block text-[11px] font-medium text-slate-600 mb-1">Peso-alvo recomendado em kg (opcional)</span>
              <input type="text" inputMode="decimal" value={pesoAlvo} onChange={(e) => setPesoAlvo(e.target.value)} className="w-full min-w-0 text-sm border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400" />
            </label>
          </div>
        </section>

        {/* 2. METRICAS DE BIOIMPEDANCIA */}
        <section className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-4 gap-3 mt-5">
          <CardMetrica
            rotulo="Percentual de Gordura"
            valor={refC ? par(refC, atualC, "pctGordura", "%") : "—"}
            detalhe={refC ? `em ${plural(mesesC)}` : "informe o % de gordura"}
          />
          <CardMetrica
            rotulo="Peso de Gordura Corporal"
            valor={refC ? parKg(refC, atualC, "gordura") : "—"}
            detalhe={refC ? `${difKg(refC, atualC, "gordura")} em ${plural(mesesC)}` : "informe o % de gordura"}
          />
          <CardMetrica
            rotulo="% de Musculatura"
            valor={refM ? par(refM, atualM, "pctMusculo", "%") : "—"}
            detalhe={refM ? `em ${plural(mesesM)}` : "informe o % de musculatura"}
          />
          <CardMetrica
            rotulo="Peso em Músculo"
            valor={refM ? parKg(refM, atualM, "musculo") : "—"}
            detalhe={refM ? `${difKg(refM, atualM, "musculo")} em ${plural(mesesM)}` : "informe o % de musculatura"}
          />
          <CardMetrica
            rotulo="Massa Livre de Gordura (Massa Magra)"
            valor={refC ? `${sinal(ganhoMagra)}${f1(Math.abs(ganhoMagra))} kg` : "—"}
            detalhe={refC ? "estimada" : "informe o % de gordura"}
          />
          <CardMetrica
            rotulo="IMC (kg/m²)"
            valor={imcInfo ? (imcInfo.ref != null ? `${f1(imcInfo.ref)} → ${f1(imcInfo.atual)}` : f1(imcInfo.atual)) : "—"}
            detalhe={imcInfo ? imcInfo.classe : "informe a altura"}
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
                ? `${Math.round(visPara)}`
                : `${Math.round(visDe)} → ${Math.round(visPara)}`
            }
            detalhe={visPara == null ? "informe o nível visceral" : faixaVisceral(Math.round(visPara))}
          />
        </section>

        {/* 2b. ANALISE DA COMPOSICAO CORPORAL */}
        {(linhasComp.some((l) => l.valor != null) || pontosNum != null || alvoNum != null) && (
          <section className="grid gap-3 mt-5 md:grid-cols-3 print:grid-cols-3 break-inside-avoid">
            {linhasComp.some((l) => l.valor != null) && (
              <div className="md:col-span-2 print:col-span-2 bg-white rounded-2xl border border-slate-200 p-4">
                <h2 className="text-sm font-semibold text-slate-900 mb-2">Análise da Composição Corporal</h2>
                <TabelaComposicao linhas={linhasComp} />
              </div>
            )}
            {(pontosNum != null || alvoNum != null) && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                {pontosNum != null && (
                  <>
                    <h2 className="text-sm font-semibold text-slate-900">Pontuação Corporal</h2>
                    <p className="mt-1 leading-none">
                      <span className="text-5xl font-semibold text-blue-500 tabular-nums">{Math.round(pontosNum)}</span>
                      <span className="text-slate-500"> /100 Pontos</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-2">Valor calculado pelo aparelho de bioimpedância.</p>
                  </>
                )}
                {alvoNum != null && (
                  <div className={pontosNum != null ? "mt-4 pt-3 border-t border-slate-100" : ""}>
                    <h2 className="text-sm font-semibold text-slate-900 mb-1">Controle de Peso</h2>
                    <p className="flex justify-between text-xs text-slate-600"><span>Peso-alvo recomendado</span><span className="tabular-nums text-slate-900">{f1(alvoNum)} kg</span></p>
                    {pesoAtualNum != null && (
                      <p className="flex justify-between text-xs text-slate-600 mt-1">
                        <span>Até o peso-alvo</span>
                        <span className="tabular-nums text-slate-900">{sinal(alvoNum - pesoAtualNum)}{f1(Math.abs(alvoNum - pesoAtualNum))} kg</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* 2c. OBESIDADE, TIPO DE CORPO E OUTROS INDICADORES */}
        {(imcInfo || (gordAtual != null && limOk) || outrosPreenchidos.length > 0) && (
          <section className="grid gap-3 mt-5 md:grid-cols-3 print:grid-cols-3 break-inside-avoid">
            {(imcInfo || (gordAtual != null && limOk)) && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h2 className="text-sm font-semibold text-slate-900 mb-1">Avaliação da Obesidade</h2>
                <div className="space-y-3">
                  {imcInfo && <BarraFaixa titulo="IMC (kg/m²)" valor={imcInfo.atual} limites={[18.5, 25, 30]} />}
                  {gordAtual != null && limOk && (
                    <BarraFaixa titulo="Taxa de gordura corporal (%)" valor={gordAtual} limites={[limA, limB, limC]} />
                  )}
                </div>
                {imcInfo && (
                  <p className="text-[9px] text-slate-400 mt-2">IMC pelas faixas da OMS para adultos; para menores de 18 anos e idosos, avaliar com referência própria.</p>
                )}
              </div>
            )}
            {imcInfo && gordAtual != null && limOk && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h2 className="text-sm font-semibold text-slate-900 mb-2">Avaliação do Tipo de Corpo</h2>
                <MatrizCorpo imc={imcInfo.atual} gord={gordAtual} a={limA} b={limB} />
              </div>
            )}
            {outrosPreenchidos.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h2 className="text-sm font-semibold text-slate-900 mb-2">Outros Indicadores</h2>
                <div className="space-y-1.5">
                  {outrosPreenchidos.map(([k, rotulo]) => {
                    const v = num(outros[k], 100000);
                    const texto = k === "tmb" || k === "idadeCorpo" ? String(Math.round(v)) : k === "whr" ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : f1(v);
                    return (
                      <p key={k} className="flex justify-between gap-2 text-xs text-slate-600">
                        <span>{rotulo}</span>
                        <span className="tabular-nums text-slate-900 shrink-0">{texto}</span>
                      </p>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 2d. GORDURA SEGMENTAR, EQUILIBRIO MUSCULAR E IMPEDANCIA */}
        {(temSegG || temSegM) && (
          <section className="grid gap-3 mt-5 md:grid-cols-2 print:grid-cols-2">
            {temSegG && (
              <div className="quadro bg-white rounded-2xl border border-slate-200 p-4">
                <h2 className="text-sm font-semibold text-slate-900">Análise de Gordura Segmentar</h2>
                <FiguraCorpo itens={segItens.gordura} />
                <p className="text-[9px] text-slate-400">Faixa padrão: {seg.faixas.gMin}% a {seg.faixas.gMax}%. A gordura segmentar é um valor inferido.</p>
              </div>
            )}
            {temSegM && (
              <div className="quadro bg-white rounded-2xl border border-slate-200 p-4">
                <h2 className="text-sm font-semibold text-slate-900">Equilíbrio Muscular</h2>
                <FiguraCorpo itens={segItens.musculo} />
                <p className="text-[9px] text-slate-400">Faixa padrão: braços {seg.faixas.bMin}% a {seg.faixas.bMax}%; tronco e pernas {seg.faixas.tMin}% a {seg.faixas.tMax}%.</p>
              </div>
            )}
          </section>
        )}
        {temImp && (
          <section className="quadro mt-3 bg-white rounded-2xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">Impedância Bioelétrica</h2>
            <TabelaImpedancia imp20={seg.imp20} imp100={seg.imp100} />
          </section>
        )}

        {/* 3. GRAFICOS */}
        <div className="grid gap-3 mt-5 md:grid-cols-2 print:grid-cols-2">
          <CartaoGrafico titulo="Evolução do Peso Corporal" subtitulo={`${ultimoMes} meses · kg`}>
            {serie.length < 2 ? <Vazio texto="Informe o peso inicial e ao menos um mês para ver a evolução." /> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ top: 18, right: 18, left: 0, bottom: 0 }}>
                <defs>
                  <Gradiente id="gPeso" cor="#3b82f6" />
                </defs>
                <XAxis dataKey="mes" {...eixoX} />
                <YAxis {...eixoY} width={40} domain={[`dataMin - ${folgaPeso}`, `dataMax + ${folgaPeso}`]} tickCount={5} tickFormatter={(v) => v.toFixed(casasPeso)} />
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
                  label={rotuloChave(serie, "#1d4ed8")}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </CartaoGrafico>

          <CartaoGrafico titulo="Composição Corporal" subtitulo={`Gordura vs. ${graf.usaMusculo ? "músculo" : "massa magra"} · kg`}>
            {graf.dados.length < 2 ? <Vazio texto="Informe o % de gordura em ao menos dois meses para ver a composição." /> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={graf.dados} margin={{ top: 18, right: 18, left: 0, bottom: 0 }}>
                <defs>
                  <Gradiente id="gMagra" cor="#1d4ed8" />
                  <Gradiente id="gGordura" cor="#60a5fa" />
                </defs>
                <XAxis dataKey="mes" {...eixoX} />
                <YAxis {...eixoY} domain={[0, "dataMax + 10"]} tickFormatter={(v) => Math.round(v)} />
                <Tooltip content={<TooltipLimpo unidade="kg" />} />
                <Area
                  type="monotone"
                  dataKey={graf.usaMusculo ? "musculo" : "magra"}
                  name={graf.usaMusculo ? "Músculo" : "Massa magra"}
                  stroke="#1d4ed8"
                  strokeWidth={2.5}
                  fill="url(#gMagra)"
                  dot={PontoChave("#1d4ed8")}
                  label={rotuloChave(graf.dados, "#1d4ed8")}
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
                  label={rotuloChave(graf.dados, "#2563eb")}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            )}
            <div className="flex gap-4 text-[11px] text-slate-500 justify-end -mt-1">
              <span><i className="inline-block w-2.5 h-2.5 rounded-full mr-1 align-middle" style={{ background: "#1d4ed8" }} />{graf.usaMusculo ? "Músculo" : "Massa magra"}</span>
              <span><i className="inline-block w-2.5 h-2.5 rounded-full mr-1 align-middle" style={{ background: "#3b82f6" }} />Gordura</span>
            </div>
          </CartaoGrafico>
        </div>

        {/* 4. ANALISE CLINICA HIBRIDA */}
        <section className="mt-5 space-y-3">
          <div className="quadro bg-white rounded-2xl border border-slate-200 p-4">
            <BlocoEditavel titulo="Análise clínica" automatico={textoAuto} custom={comentario} setCustom={setComentario} />
          </div>
          <div className="quadro bg-black text-white p-4 rounded-xl">
            <BlocoEditavel escuro automatico={TEXTO_FISIOLOGICO} custom={destaque} setCustom={setDestaque} />
          </div>
        </section>

        {importacao && (
          <div className="print:hidden no-print fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)" }}>
            <div className="bg-white rounded-2xl shadow-xl w-full overflow-auto p-5" style={{ maxWidth: 440, maxHeight: "85vh" }}>
              <h2 className="text-base font-semibold text-slate-900">Conferir dados importados</h2>
              <p className="text-xs text-slate-500 mt-1">
                A leitura roda no seu navegador, e o arquivo não é enviado a nenhum servidor. O nome e a identificação do paciente não são importados. Leitura por imagem pode errar números: confira antes de aplicar.
              </p>
              <ul className="text-xs text-slate-700 mt-3 space-y-1">
                {Object.entries(importacao.r.paciente).map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-2"><span className="text-slate-500">{k === "data" ? "Data do teste" : k[0].toUpperCase() + k.slice(1)}</span><span className="tabular-nums">{k === "data" ? dataBR(v) : v}</span></li>
                ))}
                {importacao.r.comp &&
                  COMPOSICAO_ITENS.map((nome, k) => (
                    <li key={nome} className="flex justify-between gap-2">
                      <span className="text-slate-500">{nome}</span>
                      <span className="tabular-nums">{vir(importacao.r.comp[k].med)} kg ({vir(importacao.r.comp[k].min)}–{vir(importacao.r.comp[k].max)})</span>
                    </li>
                  ))}
                {importacao.r.pesoAlvo != null && <li className="flex justify-between"><span className="text-slate-500">Peso-alvo</span><span className="tabular-nums">{vir(importacao.r.pesoAlvo)} kg</span></li>}
                {importacao.r.pontuacao != null && <li className="flex justify-between"><span className="text-slate-500">Pontuação corporal</span><span className="tabular-nums">{importacao.r.pontuacao}</span></li>}
                {importacao.r.visceral != null && <li className="flex justify-between"><span className="text-slate-500">Gordura visceral (nível)</span><span className="tabular-nums">{importacao.r.visceral}</span></li>}
                {OUTROS_ITENS.filter(([k]) => importacao.r.outros[k] != null).map(([k, rot]) => (
                  <li key={k} className="flex justify-between gap-2"><span className="text-slate-500">{rot}</span><span className="tabular-nums">{importacao.r.outros[k]}</span></li>
                ))}
                {importacao.r.imp20 && <li className="flex justify-between gap-2"><span className="text-slate-500">Impedância 20 kHz</span><span className="tabular-nums">{importacao.r.imp20.map((v) => vir(v)).join(" · ")}</span></li>}
                {importacao.r.imp100 && <li className="flex justify-between gap-2"><span className="text-slate-500">Impedância 100 kHz</span><span className="tabular-nums">{importacao.r.imp100.map((v) => vir(v)).join(" · ")}</span></li>}
              </ul>
              {importacao.r.avisos.map((a) => (
                <p key={a} className="text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1 mt-2">{a}</p>
              ))}
              {importacao.r.comp && (
                <label className="block mt-3 text-xs text-slate-600">
                  Gravar peso, % de gordura e % de musculatura em:
                  <select value={importacao.slot} onChange={(e) => setImportacao((x) => ({ ...x, slot: Number(e.target.value) }))} className="mt-1 w-full border border-slate-200 rounded-md px-2 py-1 text-sm bg-white">
                    {ROTULOS.map((_, i) => (
                      <option key={i} value={i}>{i === 0 ? "Peso inicial" : `Mês ${i}`}{num(registros[i].peso, 400) != null ? " (substitui o valor atual)" : ""}</option>
                    ))}
                  </select>
                </label>
              )}
              <details className="mt-3">
                <summary className="text-[11px] text-slate-400 cursor-pointer">Texto lido do arquivo</summary>
                <pre className="text-[10px] text-slate-500 whitespace-pre-wrap mt-1" style={{ maxHeight: 160, overflow: "auto" }}>{importacao.texto}</pre>
              </details>
              <div className="flex justify-end gap-2 mt-4">
                <button className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() => setImportacao(null)}>Cancelar</button>
                <button className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={aplicarImportacao}>Aplicar dados</button>
              </div>
            </div>
          </div>
        )}

        <footer className="mt-6 pt-3 border-t border-slate-200 text-[11px] text-slate-400 flex justify-between">
          <span>Valores de bioimpedância são estimativas e variam com hidratação e horário da medição.</span>
          <span>{dataBR(paciente.data)}</span>
        </footer>
      </main>
    </div>
  );
}
