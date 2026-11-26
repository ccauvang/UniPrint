const MAX_PAGES = 300; // same cap as routes/files.js - keep in sync
const MAX_COPIES = 1000;
const MAX_NOTE = 200;
const COLOR_MODES = ['bw', 'color'];
const SIDES = ['single', 'double'];

const isInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const pick = (list, code) => (code === undefined ? list[0] : list.find((x) => x.code === code));

// returns { error } or the full price breakdown - never throws, routes stay flat
function quote(cfg, pageCount, input) {
  if (!isInt(pageCount, 1, MAX_PAGES)) return { error: `pageCount must be a whole number 1-${MAX_PAGES}` };
  const copies = input.copies === undefined ? 1 : input.copies;
  if (!isInt(copies, 1, MAX_COPIES)) return { error: `copies must be a whole number 1-${MAX_COPIES}` };

  const size = pick(cfg.paperSizes, input.paperSize);
  if (!size) return { error: 'Invalid paperSize' };
  const type = pick(cfg.paperTypes, input.paperType);
  if (!type) return { error: 'Invalid paperType' };

  const colorMode = input.colorMode === undefined ? 'bw' : input.colorMode;
  if (!COLOR_MODES.includes(colorMode)) return { error: 'colorMode must be bw or color' };
  const printSide = input.printSide === undefined ? 'single' : input.printSide;
  if (!SIDES.includes(printSide)) return { error: 'printSide must be single or double' };

  const wantsBinding = input.binding !== undefined && input.binding !== null && input.binding !== '';
  const binding = wantsBinding ? cfg.bindings.find((b) => b.code === input.binding) : null;
  if (wantsBinding && !binding) return { error: 'Invalid binding' };

  const note = input.note === undefined || input.note === null ? '' : input.note;
  if (typeof note !== 'string' || note.length > MAX_NOTE) {
    return { error: `note must be text, max ${MAX_NOTE} chars` };
  }

  // tier follows total pages over all copies - 10 copies x 20 pages counts as 200
  const totalPages = pageCount * copies;
  const tier = cfg.priceTiers
    .filter((t) => totalPages >= t.minPages)
    .sort((a, b) => b.minPages - a.minPages)[0];
  if (!tier) return { error: 'Price tiers not set up' };

  const base = colorMode === 'color' ? tier.colorPrice : tier.bwPrice;
  const duplex = printSide === 'double' ? cfg.duplexMultiplier : 1;
  const pricePerPage = base * size.multiplier * type.multiplier * duplex;
  const bindingPrice = binding ? binding.price : 0;
  // round per copy - cart shows unit and total, total must equal unit * copies
  const unitPrice = Math.round(pageCount * pricePerPage) + bindingPrice;

  return {
    copies,
    specs: {
      paperSize: size.code,
      paperType: type.code,
      colorMode,
      printSide,
      binding: binding ? binding.code : null,
      note: note.trim()
    },
    totalPages,
    pricePerPage: Math.round(pricePerPage * 100) / 100,
    bindingPrice,
    unitPrice,
    totalPrice: unitPrice * copies
  };
}

module.exports = { quote };