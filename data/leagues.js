// FC 25 Leagues & Clubs dataset — the single source of truth for which clubs
// exist in the game. AI concept generation may ONLY pick clubs from this list,
// and league/division are always derived from here, never from the AI.
// To add a league: add an entry below — prompts and validation pick it up automatically.
const Leagues = (() => {
  const FC25_LEAGUES = {
    // ─── ENGLAND ───────────────────────────────────────────────
    'Premier League': {
      country: 'England',
      tier: 1,
      clubs: [
        'Manchester City', 'Liverpool', 'Arsenal', 'Aston Villa', 'Newcastle United',
        'Tottenham Hotspur', 'Chelsea', 'Manchester United', 'Nottingham Forest',
        'West Ham United', 'Crystal Palace', 'Brighton & Hove Albion', 'Fulham',
        'Brentford', 'AFC Bournemouth', 'Everton', 'Wolverhampton Wanderers',
        'Ipswich Town', 'Leicester City', 'Southampton',
      ],
    },
    'Championship': {
      country: 'England',
      tier: 2,
      clubs: [
        'Leeds United', 'Burnley', 'Sheffield United', 'Middlesbrough', 'Luton Town',
        'Sunderland', 'Hull City', 'Coventry City', 'West Bromwich Albion',
        'Blackburn Rovers', 'Norwich City', 'Watford', 'Millwall', 'Preston North End',
        'Sheffield Wednesday', 'Bristol City', 'Queens Park Rangers', 'Cardiff City',
        'Portsmouth', 'Stoke City', 'Derby County', 'Swansea City',
        'Plymouth Argyle', 'Oxford United',
      ],
    },
    'League One': {
      country: 'England',
      tier: 3,
      clubs: [
        'Birmingham City', 'Rotherham United', 'Wycombe Wanderers', 'Wrexham',
        'Huddersfield Town', 'Barnsley', 'Bolton Wanderers', 'Blackpool',
        'Stockport County', 'Wigan Athletic', 'Reading', 'Stevenage',
        'Lincoln City', 'Charlton Athletic', 'Leyton Orient', 'Northampton Town',
        'Exeter City', 'Peterborough United', 'Mansfield Town', 'Cambridge United',
        'Bristol Rovers', 'Shrewsbury Town', 'Crawley Town', 'Burton Albion',
      ],
    },
    'League Two': {
      country: 'England',
      tier: 4,
      clubs: [
        'Milton Keynes Dons', 'AFC Wimbledon', 'Notts County', 'Colchester United',
        'Port Vale', 'Chesterfield', 'Grimsby Town', 'Gillingham', 'Walsall',
        'Bradford City', 'Barrow', 'Swindon Town', 'Doncaster Rovers',
        'Crewe Alexandra', 'Fleetwood Town', 'Salford City', 'Carlisle United',
        'Cheltenham Town', 'Tranmere Rovers', 'Harrogate Town', 'Bromley',
        'Morecambe', 'Accrington Stanley', 'Newport County',
      ],
    },
    // ─── SPAIN ─────────────────────────────────────────────────
    'La Liga': {
      country: 'Spain',
      tier: 1,
      clubs: [
        'Real Madrid', 'FC Barcelona', 'Atlético de Madrid', 'Athletic Club de Bilbao',
        'Real Betis Balompié', 'Real Sociedad', 'Villarreal CF', 'Girona FC',
        'Valencia CF', 'CA Osasuna', 'Rayo Vallecano', 'RC Celta de Vigo',
        'RCD Mallorca', 'Sevilla FC', 'UD Las Palmas', 'Getafe CF',
        'RCD Espanyol', 'Deportivo Alavés', 'CD Leganés', 'Real Valladolid',
      ],
    },
    'La Liga 2': {
      country: 'Spain',
      tier: 2,
      clubs: [
        'UD Almería', 'Cádiz CF', 'Real Oviedo', 'Granada CF', 'RC Deportivo',
        'Real Sporting de Gijón', 'Elche CF', 'Levante UD', 'Real Zaragoza',
        'Racing de Santander', 'SD Eibar', 'Burgos CF', 'CD Tenerife',
        'Málaga CF', 'CD Mirandés', 'SD Huesca', 'CD Eldense',
        'Albacete Balompié', 'Córdoba CF', 'FC Cartagena', 'CD Castellón',
        'Racing de Ferrol',
      ],
    },
    // ─── ITALY ─────────────────────────────────────────────────
    'Serie A': {
      country: 'Italy',
      tier: 1,
      clubs: [
        'Inter', 'Milano FC', 'Juventus', 'Atalanta', 'Napoli', 'Roma',
        'Lazio', 'Fiorentina', 'Torino', 'Bologna', 'Como', 'Parma',
        'Udinese', 'Hellas Verona', 'Lecce', 'Cagliari', 'Genoa',
        'Monza', 'Empoli', 'Venezia',
      ],
    },
    'Serie B': {
      country: 'Italy',
      tier: 2,
      clubs: [
        'Palermo', 'Sassuolo', 'Sampdoria', 'Cremonese', 'Spezia', 'Modena',
        'Salernitana', 'Pisa', 'Bari', 'Catanzaro', 'Cesena', 'Frosinone',
        'Reggiana', 'Mantova', 'Cosenza', 'Südtirol', 'Brescia',
        'Cittadella', 'Juve Stabia', 'Carrarese',
      ],
    },
    // ─── GERMANY ───────────────────────────────────────────────
    'Bundesliga': {
      country: 'Germany',
      tier: 1,
      clubs: [
        'Bayern München', 'Bayer 04 Leverkusen', 'Borussia Dortmund', 'RB Leipzig',
        'VfB Stuttgart', 'VfL Wolfsburg', 'Eintracht Frankfurt', "Borussia M'gladbach",
        'SC Freiburg', 'Werder Bremen', '1. FSV Mainz 05', '1. FC Union Berlin',
        'TSG 1899 Hoffenheim', 'FC Augsburg', 'VfL Bochum', 'FC St. Pauli',
        '1. FC Heidenheim', 'Holstein Kiel',
      ],
    },
    '2. Bundesliga': {
      country: 'Germany',
      tier: 2,
      clubs: [
        '1. FC Köln', 'Hamburger SV', 'Hertha BSC', 'Hannover 96',
        'SV Darmstadt 98', 'Fortuna Düsseldorf', '1. FC Kaiserslautern',
        'FC Schalke 04', 'SV Elversberg', 'Karlsruher SC', '1. FC Magdeburg',
        'SpVgg Greuther Fürth', '1. FC Nürnberg', 'SC Paderborn 07',
        'Eintracht Braunschweig', 'Preußen Münster', 'Jahn Regensburg', 'SSV Ulm 1846',
      ],
    },
    // ─── FRANCE ────────────────────────────────────────────────
    'Ligue 1': {
      country: 'France',
      tier: 1,
      clubs: [
        'Paris Saint-Germain', 'Olympique de Marseille', 'LOSC Lille',
        'Olympique Lyonnais', 'AS Monaco', 'OGC Nice', 'Stade Rennais',
        'Stade Brestois 29', 'RC Lens', 'FC Nantes', 'RC Strasbourg',
        'AJ Auxerre', 'Montpellier HSC', 'Stade de Reims', 'Toulouse FC',
        'Le Havre AC', 'Angers SCO', 'AS Saint-Étienne',
      ],
    },
    // ─── PORTUGAL ──────────────────────────────────────────────
    'Liga Portugal': {
      country: 'Portugal',
      tier: 1,
      clubs: [
        'Benfica', 'Sporting CP', 'FC Porto', 'Sporting de Braga',
        'Vitória de Guimarães', 'Estoril', 'Arouca', 'Farense',
        'Rio Ave', 'Santa Clara', 'Gil Vicente FC', 'Boavista',
        'Moreirense', 'Famalicão', 'Casa Pia', 'AVS Futebol SAD',
        'Estrela da Amadora', 'Nacional da Madeira',
      ],
    },
    // ─── NETHERLANDS ───────────────────────────────────────────
    'Eredivisie': {
      country: 'Netherlands',
      tier: 1,
      clubs: [
        'PSV', 'Ajax', 'Feyenoord', 'FC Twente', 'FC Utrecht', 'AZ',
        'NEC Nijmegen', 'Fortuna Sittard', 'Go Ahead Eagles', 'Sparta Rotterdam',
        'NAC Breda', 'sc Heerenveen', 'PEC Zwolle', 'FC Groningen',
        'RKC Waalwijk', 'Willem II', 'Heracles Almelo', 'Almere City FC',
      ],
    },
    // ─── BELGIUM ───────────────────────────────────────────────
    'Belgium Pro League': {
      country: 'Belgium',
      tier: 1,
      clubs: [
        'Club Brugge', 'Anderlecht', 'Genk', 'Antwerp', 'Gent',
        'Union Saint-Gilloise', 'Standard Liège', 'Charleroi', 'Sint-Truiden',
        'Westerlo', 'OH Leuven', 'KV Mechelen', 'Cercle Brugge',
        'Kortrijk', 'Dender', 'Beerschot',
      ],
    },
    // ─── AUSTRIA ───────────────────────────────────────────────
    'Austrian Bundesliga': {
      country: 'Austria',
      tier: 1,
      clubs: [
        'RB Salzburg', 'Sturm Graz', 'LASK', 'SK Rapid', 'Austria Wien',
        'Wolfsberger AC', 'Hartberg', 'Austria Klagenfurt', 'SCR Altach',
        'WSG Tirol', 'Blau-Weiß Linz', 'Grazer AK',
      ],
    },
    // ─── SCOTLAND ──────────────────────────────────────────────
    'Scottish Premiership': {
      country: 'Scotland',
      tier: 1,
      clubs: [
        'Celtic', 'Rangers', 'Heart of Midlothian', 'Aberdeen', 'Hibernian',
        'Kilmarnock', 'Dundee United', 'Motherwell', 'Dundee FC',
        'St. Mirren', 'Ross County', 'St. Johnstone',
      ],
    },
    // ─── USA ───────────────────────────────────────────────────
    'MLS': {
      country: 'USA',
      tier: 1,
      clubs: [
        'Inter Miami', 'Los Angeles Galaxy', 'Los Angeles FC', 'Seattle Sounders',
        'FC Cincinnati', 'St. Louis City SC', 'Atlanta United FC', 'Charlotte FC',
        'Portland Timbers', 'Houston Dynamo', 'Vancouver Whitecaps',
        'San Jose Earthquakes', 'Orlando City SC', 'New England Revolution',
        'New York Red Bulls', 'Austin FC', 'Nashville SC', 'Columbus Crew',
        'Real Salt Lake', 'Minnesota United FC', 'Sporting KC', 'FC Dallas',
        'Toronto FC', 'Philadelphia Union', 'Chicago Fire FC', 'New York City FC',
        'Colorado Rapids', 'D.C. United', 'CF Montréal',
      ],
    },
    // ─── ARGENTINA ─────────────────────────────────────────────
    'Liga Argentina': {
      country: 'Argentina',
      tier: 1,
      clubs: [
        'River Plate', 'Boca Juniors', 'Racing Club de Avellaneda',
        'Estudiantes de La Plata', 'Talleres de Córdoba', 'Vélez Sarsfield',
        'Lanús', 'Independiente', "Newell's Old Boys", 'Rosario Central',
        'Argentinos Juniors', 'Belgrano de Córdoba', 'Gimnasia y Esgrima La Plata',
        'San Lorenzo de Almagro', 'Godoy Cruz', 'Defensa y Justicia',
        'Huracán', 'Platense', 'Barracas Central', 'Instituto de Córdoba',
        'Atlético Tucumán', 'Central Córdoba', 'Unión de Santa Fe',
        'Independiente Rivadavia', 'Sarmiento', 'Tigre', 'Banfield',
        'Deportivo Riestra',
      ],
    },
  };

  const DIVISION_LABELS = { 1: '1st Division', 2: '2nd Division', 3: '3rd Division', 4: '4th Division' };

  // Accent/case/punctuation-insensitive key so "atletico madrid" ≈ "Atlético de Madrid" fails
  // but "atlético de madrid" matches regardless of casing/accents
  function _norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  const _index = new Map();
  Object.entries(FC25_LEAGUES).forEach(([league, data]) => {
    data.clubs.forEach(club => {
      _index.set(_norm(club), {
        club,
        league,
        country: data.country,
        tier: data.tier,
        division: DIVISION_LABELS[data.tier] || `${data.tier}th Division`,
      });
    });
  });

  function findClub(name) {
    return _index.get(_norm(name)) || null;
  }

  let _promptBlock = null;
  function promptBlock() {
    if (_promptBlock) return _promptBlock;
    const lines = Object.entries(FC25_LEAGUES).map(([league, data]) => {
      const label = DIVISION_LABELS[data.tier] || `${data.tier}th Division`;
      return `${data.country.toUpperCase()} — ${league} (${label}):\n${data.clubs.join(', ')}`;
    });
    _promptBlock =
      'ALLOWED LEAGUES & CLUBS — this is the COMPLETE FC 25 list. Any club not written below does NOT exist in FC 25 and is a hard failure. Copy club and league names EXACTLY as written.\n\n' +
      lines.join('\n\n');
    return _promptBlock;
  }

  return { FC25_LEAGUES, findClub, promptBlock };
})();

// Node export for the test harness only — the app loads this as a browser global
if (typeof module !== 'undefined') {
  module.exports = Leagues;
}
