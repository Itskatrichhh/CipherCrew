const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// In-memory game storage (persists during server lifetime)
const activeGames = new Map();

// Truth or Dare questions
const truthDareQuestions = {
  easy: {
    truth: [
      "What's the most embarrassing song on your playlist?",
      "What's the silliest thing you've ever done?",
      "What's your guilty pleasure TV show?",
      "Have you ever pretended to be sick to skip something?",
      "What's the weirdest food combination you enjoy?",
      "What's the most childish thing you still do?",
      "What's your most used emoji?",
      "What was your most embarrassing moment in school?",
      "Have you ever laughed at something you shouldn't have?",
      "What's the longest you've binged a show?",
    ],
    dare: [
      "Send a funny selfie to the group",
      "Type everything in caps for the next 5 minutes",
      "Share the last photo in your gallery",
      "Send a voice message singing a random song",
      "Change your display name to something funny for 1 hour",
      "Send a message using only emojis",
      "Tell a joke that makes everyone laugh",
      "Share your screen time report",
      "Send a compliment to everyone in the group",
      "Do your best impression of someone in the group via voice note",
    ]
  },
  medium: {
    truth: [
      "What's the biggest lie you've ever told?",
      "Have you ever snooped through someone's phone?",
      "What's the most awkward date you've been on?",
      "What's a secret you've never told anyone in this group?",
      "What's the pettiest reason you've stopped talking to someone?",
      "Have you ever been caught doing something you shouldn't?",
      "What's the most impulsive thing you've ever bought?",
      "What's a movie that made you cry?",
      "Who in this group would you trust with your deepest secret?",
      "What's the most trouble you've gotten into?",
    ],
    dare: [
      "Post an embarrassing story about yourself",
      "Let the group choose your profile picture for 24 hours",
      "Call a random contact and say something nice",
      "Share the last 5 searches in your browser",
      "Write a poem about someone in the group",
      "Record yourself doing a silly dance",
      "Let someone else type a message from your account",
      "Share your most played song this month",
      "Do 10 pushups and send video proof",
      "Speak in an accent for the next 10 minutes",
    ]
  },
  hard: {
    truth: [
      "What's the biggest secret you're keeping right now?",
      "Have you ever had a crush on someone in this group?",
      "What's the worst thing you've done that no one knows about?",
      "What's something about you that would surprise everyone here?",
      "If you had to remove one person from this group, who would it be?",
      "What's the most illegal thing you've ever done?",
      "What's your biggest regret in life so far?",
      "Have you ever betrayed a friend's trust?",
      "What's the most hurtful thing someone has said to you?",
      "If you could redo one decision in your life, what would it be?",
    ],
    dare: [
      "Post something on your social media chosen by the group",
      "Call your crush/partner and put them on speaker",
      "Share your most embarrassing photo ever",
      "Text your parents 'I need to tell you something' and screenshot the reply",
      "Let the group send one message from your phone to anyone",
      "Do a live video of you doing something embarrassing",
      "Share your browser history from today",
      "Write a love letter to someone the group picks",
      "Give your phone to someone for 2 minutes",
      "Confess something you've never told this group",
    ]
  }
};

// Mystery cases
const mysteryCases = [
  {
    id: 'case-001',
    title: 'The Missing Diamond',
    difficulty: 'Easy',
    description: 'A precious diamond has vanished from the museum. Three suspects, one thief. Can your squad crack the case?',
    story: `The Grand City Museum reported a missing diamond from their vault at 9 AM Monday morning. The 50-carat "Star of the East" was last seen at closing time Sunday (6 PM). Security footage shows three people accessed the vault area after hours.`,
    suspects: [
      { name: 'Dr. Sarah Chen', role: 'Museum Curator', alibi: 'Claims she was at a dinner party until 11 PM', clue: 'Her keycard was used at 8:47 PM' },
      { name: 'Marcus Webb', role: 'Security Guard', alibi: 'Says he was doing rounds on the 2nd floor', clue: 'CCTV shows him near the vault at 9:15 PM' },
      { name: 'Elena Rossi', role: 'Cleaning Staff', alibi: 'Claims she left at 7 PM sharp', clue: 'Her badge was scanned at exit at 10:30 PM' }
    ],
    clues: [
      'The vault requires two keycards to open',
      'A cleaning cart was found near the vault with traces of glass cleaner',
      'Dr. Chen\'s dinner party host confirms she left at 9:30 PM',
      'Marcus Webb\'s personal locker contained a small velvet pouch',
      'Elena\'s timecard shows overtime that was not approved'
    ],
    solution: 'Marcus Webb and Elena Rossi worked together. Elena stayed late (despite claiming she left at 7 PM) and used her card along with a stolen copy of Dr. Chen\'s card. Marcus distracted the other guard while Elena accessed the vault. The velvet pouch in Marcus\'s locker was for transporting the diamond.'
  },
  {
    id: 'case-002',
    title: 'The Poisoned Party',
    difficulty: 'Medium',
    description: 'Someone at the dinner party isn\'t who they seem. A guest has been poisoned. Who did it and how?',
    story: `At billionaire James Morton's annual dinner party, guest Victoria Lane collapsed after dessert. The doctor found traces of a rare toxin. All 4 remaining guests are suspects.`,
    suspects: [
      { name: 'James Morton', role: 'Host', alibi: 'Was giving a toast when Victoria collapsed', clue: 'Had recently changed his will, removing Victoria' },
      { name: 'Diana Fox', role: 'Victoria\'s Business Partner', alibi: 'Was in the restroom', clue: 'Victoria was suing her for embezzlement' },
      { name: 'Chef Antoine', role: 'Private Chef', alibi: 'Was in the kitchen preparing coffee', clue: 'The toxin was found only in Victoria\'s dessert' },
      { name: 'Robert Lane', role: 'Victoria\'s Husband', alibi: 'Was sitting next to Victoria', clue: 'Has a $2M life insurance policy on Victoria' }
    ],
    clues: [
      'The toxin takes exactly 30 minutes to take effect',
      'Victoria\'s dessert was served at 8:15 PM, she collapsed at 8:45 PM',
      'Diana was seen whispering to Chef Antoine before dinner',
      'Robert recently had large gambling debts',
      'The toxin is derived from a plant found in James\'s garden',
      'Chef Antoine owed Diana a significant favor'
    ],
    solution: 'Diana Fox orchestrated the poisoning. She convinced Chef Antoine (who owed her a favor) to add the toxin to only Victoria\'s dessert plate. The toxin came from James\'s garden, which Diana had access to as a frequent visitor. Her motive was to prevent the embezzlement lawsuit that would have ruined her.'
  },
  {
    id: 'case-003',
    title: 'The Digital Heist',
    difficulty: 'Hard',
    description: 'A tech company\'s servers were breached and millions in crypto stolen. Track the digital breadcrumbs.',
    story: `NexaCorp's cryptocurrency wallet was drained of $5M in Bitcoin overnight. The breach happened between 2-4 AM. Three employees had the required access level.`,
    suspects: [
      { name: 'Alex Kim', role: 'Lead Developer', alibi: 'Claims to have been asleep at home', clue: 'His VPN was active from 1:55 AM to 4:10 AM' },
      { name: 'Priya Sharma', role: 'Security Engineer', alibi: 'Was at a late-night coding meetup', clue: 'Had recently been denied a promotion' },
      { name: 'Tom Baker', role: 'DevOps Manager', alibi: 'Says he was monitoring a server migration', clue: 'The migration was scheduled but logs show it was cancelled' }
    ],
    clues: [
      'The breach used a zero-day exploit that was reported internally 3 days ago',
      'Only the security team knew about the vulnerability',
      'The Bitcoin was sent to a mixing service immediately',
      'Tom\'s work laptop shows he accessed the crypto wallet documentation at 11 PM',
      'Alex\'s home IP doesn\'t match the VPN connection source',
      'Priya\'s meetup ended at 1 AM, verified by 3 attendees',
      'A new wallet was created from a café\'s WiFi 2 days before the heist'
    ],
    solution: 'Tom Baker executed the heist. He scheduled a fake server migration as cover for being online late at night. He learned about the vulnerability from internal reports (which DevOps also had access to), created the receiving wallet from a café to avoid tracing, and used the zero-day exploit during his "migration window." The cancelled migration logs prove his alibi was fabricated.'
  },
  {
    id: 'case-004',
    title: 'The Vanishing Artist',
    difficulty: 'Expert',
    description: 'A famous street artist disappeared after their final masterpiece. Was it voluntary, or something darker?',
    story: `Renowned anonymous street artist "Ghost" created their most controversial piece on City Hall at 3 AM, then vanished. Their studio was found ransacked. Three people had recent conflicts with Ghost.`,
    suspects: [
      { name: 'Maya Torres', role: 'Art Gallery Owner', alibi: 'Was at her gallery opening until 2 AM', clue: 'Had offered Ghost $1M for an exclusive deal, was rejected' },
      { name: 'Detective Ron Harris', role: 'Police Detective', alibi: 'Was on night shift patrol', clue: 'Had been trying to unmask Ghost for years' },
      { name: 'Jake "Shade" Morrison', role: 'Rival Street Artist', alibi: 'Claims he was painting in the abandoned warehouse district', clue: 'Ghost had publicly humiliated his work last week' }
    ],
    clues: [
      'Ghost\'s studio had no signs of forced entry',
      'A burner phone in the studio had only 3 contacts: M, R, and S',
      'Maya\'s security cameras show her leaving at 2:15 AM, heading unknown',
      'Detective Harris was seen near Ghost\'s neighborhood at 3:30 AM',
      'Shade\'s warehouse had fresh paint matching Ghost\'s final piece',
      'Ghost\'s passport and emergency bag are missing from the studio',
      'A boat was rented under a fake name from the marina at 4 AM',
      'Ghost had been receiving threatening letters for weeks'
    ],
    solution: 'Ghost staged their own disappearance. The ransacked studio was a misdirection — Ghost took their passport and emergency bag (no forced entry = they did it themselves). Ghost rented the boat to escape, having planned this after receiving threats (likely from Detective Harris). The final masterpiece on City Hall was their farewell statement. The threatening letters from Harris pushed up the timeline. Ghost is alive and has simply gone underground with a new identity.'
  }
];

// GET /api/games/active
router.get('/active', authMiddleware, (req, res) => {
  const games = Array.from(activeGames.values()).filter(g => g.status === 'active' || g.status === 'waiting');
  res.json({ games });
});

// GET /api/games/:gameId
router.get('/:gameId', authMiddleware, (req, res) => {
  const game = activeGames.get(req.params.gameId);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  res.json({ game });
});

// GET /api/games/truth-dare/questions
router.get('/truth-dare/questions', authMiddleware, (req, res) => {
  const { level = 'easy', type = 'truth' } = req.query;

  const questions = truthDareQuestions[level]?.[type] || truthDareQuestions.easy.truth;
  
  // Return shuffled questions
  const shuffled = [...questions].sort(() => Math.random() - 0.5);
  res.json({ questions: shuffled });
});

// GET /api/games/mystery-cases
router.get('/mystery-cases', authMiddleware, (req, res) => {
  // Return cases without solutions
  const casesWithoutSolutions = mysteryCases.map(({ solution, ...rest }) => rest);
  res.json({ cases: casesWithoutSolutions });
});

// GET /api/games/mystery-cases/:caseId
router.get('/mystery-cases/:caseId', authMiddleware, (req, res) => {
  const mysteryCase = mysteryCases.find(c => c.id === req.params.caseId);
  if (!mysteryCase) {
    return res.status(404).json({ error: 'Case not found' });
  }
  res.json({ case: mysteryCase });
});

module.exports = router;
module.exports.activeGames = activeGames;
