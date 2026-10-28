// Lo que consulta la app (js/datosvivos.js): promos vigentes e inflación.
// ?prov=<provincia> devuelve solo las promos nacionales y las de esa provincia.
// ?extra=<nombres> registra los bancos o billeteras que agregaron los usuarios
// para que el complemento busque también sus promos.

import { refs, todayAR } from './_lib/actualizar.js';
import { inZone } from './_lib/zona.js';

export default async function handler(req, res) {
  try {
    const { DOC, CFG } = refs();
    const extra = String(req.query.extra || '').split(',').map((n) => n.replace(/[^\p{L}\p{N} .+-]/gu, '').trim().slice(0, 40)).filter((n) => n.length >= 3).slice(0, 5);
    if (extra.length) {
      const cfg = (await CFG.get()).data() || {};
      const list = cfg.extraWallets || [];
      const add = extra.filter((n) => !list.some((x) => x.toLowerCase() === n.toLowerCase()));
      if (add.length && list.length < 60) await CFG.set({ extraWallets: [...list, ...add].slice(0, 60) }, { merge: true });
    }
    const doc = (await DOC.get()).data() || {};
    const today = todayAR();
    const prov = String(req.query.prov || '').slice(0, 40);
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    return res.status(200).json({
      promos: (doc.promos || []).filter((p) => p.validTo >= today && (!prov || inZone(p.zone, prov))),
      ipc: doc.ipc || {},
      sources: doc.sources || [],
      updatedAt: doc.updatedAt || null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'No disponible' });
  }
}
