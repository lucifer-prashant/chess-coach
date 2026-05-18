/**
 * Minimal opening detection. Hardcoded ECO-ish lookup by SAN prefix.
 * Not exhaustive — covers ~50 most common lines kids/club players hit.
 */

interface Opening { eco: string; name: string; moves: string[] }

const BOOK: Opening[] = [
  // 1.e4 lines
  { eco: 'B00', name: 'King\'s Pawn', moves: ['e4'] },
  { eco: 'B20', name: 'Sicilian Defense', moves: ['e4', 'c5'] },
  { eco: 'B21', name: 'Sicilian, Smith-Morra', moves: ['e4', 'c5', 'd4'] },
  { eco: 'B23', name: 'Sicilian, Closed', moves: ['e4', 'c5', 'Nc3'] },
  { eco: 'B27', name: 'Sicilian, Hyperaccelerated Dragon', moves: ['e4', 'c5', 'Nf3', 'g6'] },
  { eco: 'B30', name: 'Sicilian, Old Sicilian', moves: ['e4', 'c5', 'Nf3', 'Nc6'] },
  { eco: 'B40', name: 'Sicilian, French Variation', moves: ['e4', 'c5', 'Nf3', 'e6'] },
  { eco: 'B50', name: 'Sicilian, Najdorf prep', moves: ['e4', 'c5', 'Nf3', 'd6'] },
  { eco: 'B90', name: 'Sicilian, Najdorf', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'] },
  { eco: 'B10', name: 'Caro-Kann', moves: ['e4', 'c6'] },
  { eco: 'B12', name: 'Caro-Kann, Advance', moves: ['e4', 'c6', 'd4', 'd5', 'e5'] },
  { eco: 'C00', name: 'French Defense', moves: ['e4', 'e6'] },
  { eco: 'C02', name: 'French, Advance', moves: ['e4', 'e6', 'd4', 'd5', 'e5'] },
  { eco: 'C10', name: 'French, Rubinstein', moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'dxe4'] },
  { eco: 'B01', name: 'Scandinavian Defense', moves: ['e4', 'd5'] },
  { eco: 'B07', name: 'Pirc Defense', moves: ['e4', 'd6'] },
  { eco: 'B08', name: 'Modern Defense', moves: ['e4', 'g6'] },
  { eco: 'B02', name: 'Alekhine Defense', moves: ['e4', 'Nf6'] },
  { eco: 'C20', name: 'King\'s Pawn Game', moves: ['e4', 'e5'] },
  { eco: 'C30', name: 'King\'s Gambit', moves: ['e4', 'e5', 'f4'] },
  { eco: 'C40', name: 'King\'s Knight Opening', moves: ['e4', 'e5', 'Nf3'] },
  { eco: 'C41', name: 'Philidor Defense', moves: ['e4', 'e5', 'Nf3', 'd6'] },
  { eco: 'C42', name: 'Petroff Defense', moves: ['e4', 'e5', 'Nf3', 'Nf6'] },
  { eco: 'C44', name: 'Scotch Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'] },
  { eco: 'C45', name: 'Scotch Game, Main', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4'] },
  { eco: 'C50', name: 'Italian Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] },
  { eco: 'C53', name: 'Giuoco Piano', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'] },
  { eco: 'C57', name: 'Two Knights Defense', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'] },
  { eco: 'C60', name: 'Ruy López', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'C65', name: 'Ruy López, Berlin', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'] },
  { eco: 'C68', name: 'Ruy López, Exchange', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6'] },
  { eco: 'C84', name: 'Ruy López, Closed', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7'] },
  { eco: 'C46', name: 'Four Knights', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6'] },
  { eco: 'C55', name: 'Vienna Game', moves: ['e4', 'e5', 'Nc3'] },

  // 1.d4 lines
  { eco: 'A40', name: 'Queen\'s Pawn', moves: ['d4'] },
  { eco: 'A45', name: 'Indian Defense', moves: ['d4', 'Nf6'] },
  { eco: 'E60', name: 'King\'s Indian Defense', moves: ['d4', 'Nf6', 'c4', 'g6'] },
  { eco: 'E20', name: 'Nimzo-Indian', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'] },
  { eco: 'E10', name: 'Queen\'s Indian setup', moves: ['d4', 'Nf6', 'c4', 'e6'] },
  { eco: 'E12', name: 'Queen\'s Indian Defense', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6'] },
  { eco: 'D70', name: 'Grünfeld Defense', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'] },
  { eco: 'D02', name: 'Queen\'s Pawn Game', moves: ['d4', 'd5'] },
  { eco: 'D06', name: 'Queen\'s Gambit', moves: ['d4', 'd5', 'c4'] },
  { eco: 'D20', name: 'Queen\'s Gambit Accepted', moves: ['d4', 'd5', 'c4', 'dxc4'] },
  { eco: 'D30', name: 'Queen\'s Gambit Declined', moves: ['d4', 'd5', 'c4', 'e6'] },
  { eco: 'D35', name: 'QGD, Exchange', moves: ['d4', 'd5', 'c4', 'e6', 'cxd5'] },
  { eco: 'D10', name: 'Slav Defense', moves: ['d4', 'd5', 'c4', 'c6'] },
  { eco: 'A80', name: 'Dutch Defense', moves: ['d4', 'f5'] },
  { eco: 'A40', name: 'Benoni / Modern Defense', moves: ['d4', 'c5'] },
  { eco: 'A56', name: 'Benoni Defense', moves: ['d4', 'Nf6', 'c4', 'c5'] },

  // Other
  { eco: 'A04', name: 'Réti Opening', moves: ['Nf3'] },
  { eco: 'A10', name: 'English Opening', moves: ['c4'] },
  { eco: 'A00', name: 'Bird\'s Opening', moves: ['f4'] },
  { eco: 'A00', name: 'Sokolsky / Orangutan', moves: ['b4'] },
  { eco: 'A00', name: 'Larsen\'s Opening', moves: ['b3'] },
];

const SORTED = [...BOOK].sort((a, b) => b.moves.length - a.moves.length);

/** Match the deepest opening that matches the SAN prefix. */
export function detectOpening(sanList: string[]): { eco: string; name: string } | null {
  for (const o of SORTED) {
    if (o.moves.length > sanList.length) continue;
    let ok = true;
    for (let i = 0; i < o.moves.length; i++) {
      if (sanList[i] !== o.moves[i]) { ok = false; break; }
    }
    if (ok) return { eco: o.eco, name: o.name };
  }
  return null;
}
