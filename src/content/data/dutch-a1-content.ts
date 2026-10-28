/**
 * Dutch A0 → A1 Content Data
 * 
 * A small validated content slice covering initial topics:
 * - Greetings
 * - Numbers
 * - Family
 * 
 * All content includes:
 * - Nouns with de/het article + plural (R9.1, R9.2)
 * - Verbs with present tense conjugation (R9.3)
 * - Example sentences
 * - Curated accepted answers and alternatives
 * 
 * Structure allows A2+ modules to be added without restructuring (R10.7).
 * 
 * @module content/data/dutch-a1-content
 */

import type {
  LanguageEntity,
  ModuleEntity,
  LessonEntity,
  LearningItemEntity,
  VocabularyEntity,
  GrammarInfoEntity,
  ExampleEntity,
  ExerciseEntity,
  PresentTenseConjugation,
} from '../../persistence/entities';

// ============================================================================
// Helper to generate UUIDs (deterministic for content seeding)
// ============================================================================

let counter = 0;
function generateId(prefix: string): string {
  counter++;
  return `${prefix}-${String(counter).padStart(6, '0')}`;
}

function resetIdCounter(): void {
  counter = 0;
}

const NOW = new Date().toISOString();

// ============================================================================
// Language
// ============================================================================

export const dutchLanguage: LanguageEntity = {
  id: 'lang-dutch-001',
  code: 'nl',
  name: 'Dutch',
  isValidationAsset: false,
  updatedAt: NOW,
};

// ============================================================================
// Modules
// ============================================================================

export const dutchModules: ModuleEntity[] = [
  {
    id: 'mod-dutch-a1-001',
    languageId: dutchLanguage.id,
    order: 1,
    title: 'Getting Started',
    cefrObjective: 'A1.1',
    updatedAt: NOW,
  },
  {
    id: 'mod-dutch-a1-002',
    languageId: dutchLanguage.id,
    order: 2,
    title: 'Numbers & Counting',
    cefrObjective: 'A1.1',
    updatedAt: NOW,
  },
  {
    id: 'mod-dutch-a1-003',
    languageId: dutchLanguage.id,
    order: 3,
    title: 'Family & People',
    cefrObjective: 'A1.2',
    updatedAt: NOW,
  },
];

// ============================================================================
// Lessons
// ============================================================================

export const dutchLessons: LessonEntity[] = [
  // Module 1: Getting Started
  {
    id: 'les-dutch-001',
    moduleId: 'mod-dutch-a1-001',
    order: 1,
    title: 'Basic Greetings',
    cefrObjective: 'A1',
    grammarExplanationId: null,
    updatedAt: NOW,
  },
  {
    id: 'les-dutch-002',
    moduleId: 'mod-dutch-a1-001',
    order: 2,
    title: 'Introductions',
    cefrObjective: 'A1',
    grammarExplanationId: null,
    updatedAt: NOW,
  },
  // Module 2: Numbers
  {
    id: 'les-dutch-003',
    moduleId: 'mod-dutch-a1-002',
    order: 1,
    title: 'Numbers 1-10',
    cefrObjective: 'A1',
    grammarExplanationId: null,
    updatedAt: NOW,
  },
  {
    id: 'les-dutch-004',
    moduleId: 'mod-dutch-a1-002',
    order: 2,
    title: 'Numbers 11-20',
    cefrObjective: 'A1',
    grammarExplanationId: null,
    updatedAt: NOW,
  },
  // Module 3: Family
  {
    id: 'les-dutch-005',
    moduleId: 'mod-dutch-a1-003',
    order: 1,
    title: 'Immediate Family',
    cefrObjective: 'A1',
    grammarExplanationId: null,
    updatedAt: NOW,
  },
  {
    id: 'les-dutch-006',
    moduleId: 'mod-dutch-a1-003',
    order: 2,
    title: 'Extended Family',
    cefrObjective: 'A1',
    grammarExplanationId: null,
    updatedAt: NOW,
  },
];

// ============================================================================
// Learning Items, Vocabulary, Grammar Info, Examples, Exercises
// ============================================================================

resetIdCounter();

// --- Lesson 1: Basic Greetings ---

const greetingItems: {
  item: LearningItemEntity;
  vocabulary: VocabularyEntity;
  grammarInfo?: GrammarInfoEntity;
  examples: ExampleEntity[];
  exercises: ExerciseEntity[];
}[] = [
  // hallo
  {
    item: {
      id: 'item-hallo',
      languageId: dutchLanguage.id,
      lessonId: 'les-dutch-001',
      kind: 'vocabulary',
      prompt: 'hello',
      skillDimensions: ['meaning', 'spelling', 'listening-recognition'],
      contentState: 'available',
      updatedAt: NOW,
    },
    vocabulary: {
      id: 'vocab-hallo',
      learningItemId: 'item-hallo',
      targetText: 'hallo',
      acceptedAnswers: ['hallo', 'hello'],
      alternativeTranslations: ['hi', 'hey'],
      updatedAt: NOW,
    },
    examples: [
      {
        id: 'ex-hallo-1',
        learningItemId: 'item-hallo',
        sentenceTarget: 'Hallo, hoe gaat het?',
        sentenceExplanation: 'Hello, how are you?',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
    exercises: [
      {
        id: 'exer-hallo-1',
        learningItemId: 'item-hallo',
        type: 'flashcard',
        config: { showHint: true },
        objective: 'Recognize the Dutch word for "hello"',
        contentState: 'available',
        updatedAt: NOW,
      },
      {
        id: 'exer-hallo-2',
        learningItemId: 'item-hallo',
        type: 'typed-translation',
        config: {},
        objective: 'Spell the Dutch word for "hello"',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
  },
  // goedemorgen
  {
    item: {
      id: 'item-goedemorgen',
      languageId: dutchLanguage.id,
      lessonId: 'les-dutch-001',
      kind: 'vocabulary',
      prompt: 'good morning',
      skillDimensions: ['meaning', 'spelling', 'listening-recognition'],
      contentState: 'available',
      updatedAt: NOW,
    },
    vocabulary: {
      id: 'vocab-goedemorgen',
      learningItemId: 'item-goedemorgen',
      targetText: 'goedemorgen',
      acceptedAnswers: ['goedemorgen', 'goede morgen'],
      alternativeTranslations: ['morning'],
      updatedAt: NOW,
    },
    examples: [
      {
        id: 'ex-goedemorgen-1',
        learningItemId: 'item-goedemorgen',
        sentenceTarget: 'Goedemorgen! Heb je goed geslapen?',
        sentenceExplanation: 'Good morning! Did you sleep well?',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
    exercises: [
      {
        id: 'exer-goedemorgen-1',
        learningItemId: 'item-goedemorgen',
        type: 'flashcard',
        config: {},
        objective: 'Recognize the Dutch greeting for morning',
        contentState: 'available',
        updatedAt: NOW,
      },
      {
        id: 'exer-goedemorgen-2',
        learningItemId: 'item-goedemorgen',
        type: 'listening',
        config: {},
        objective: 'Recognize "goedemorgen" when spoken',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
  },
  // tot ziens
  {
    item: {
      id: 'item-totziens',
      languageId: dutchLanguage.id,
      lessonId: 'les-dutch-001',
      kind: 'vocabulary',
      prompt: 'goodbye',
      skillDimensions: ['meaning', 'spelling', 'listening-recognition'],
      contentState: 'available',
      updatedAt: NOW,
    },
    vocabulary: {
      id: 'vocab-totziens',
      learningItemId: 'item-totziens',
      targetText: 'tot ziens',
      acceptedAnswers: ['tot ziens', 'totziens'],
      alternativeTranslations: ['see you', 'bye'],
      updatedAt: NOW,
    },
    examples: [
      {
        id: 'ex-totziens-1',
        learningItemId: 'item-totziens',
        sentenceTarget: 'Tot ziens! Tot morgen!',
        sentenceExplanation: 'Goodbye! See you tomorrow!',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
    exercises: [
      {
        id: 'exer-totziens-1',
        learningItemId: 'item-totziens',
        type: 'multiple-choice',
        config: { options: ['tot ziens', 'goedemorgen', 'hallo', 'dank je'] },
        objective: 'Select the correct Dutch word for "goodbye"',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
  },
  // dank je (wel)
  {
    item: {
      id: 'item-dankje',
      languageId: dutchLanguage.id,
      lessonId: 'les-dutch-001',
      kind: 'vocabulary',
      prompt: 'thank you',
      skillDimensions: ['meaning', 'spelling'],
      contentState: 'available',
      updatedAt: NOW,
    },
    vocabulary: {
      id: 'vocab-dankje',
      learningItemId: 'item-dankje',
      targetText: 'dank je',
      acceptedAnswers: ['dank je', 'dank je wel', 'bedankt', 'dankjewel'],
      alternativeTranslations: ['thanks'],
      updatedAt: NOW,
    },
    examples: [
      {
        id: 'ex-dankje-1',
        learningItemId: 'item-dankje',
        sentenceTarget: 'Dank je wel voor je hulp!',
        sentenceExplanation: 'Thank you for your help!',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
    exercises: [
      {
        id: 'exer-dankje-1',
        learningItemId: 'item-dankje',
        type: 'typed-translation',
        config: {},
        objective: 'Write "thank you" in Dutch',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
  },
];

// --- Lesson 5: Immediate Family (nouns with de/het) ---

const familyItems: {
  item: LearningItemEntity;
  vocabulary: VocabularyEntity;
  grammarInfo: GrammarInfoEntity;
  examples: ExampleEntity[];
  exercises: ExerciseEntity[];
}[] = [
  // de vader (father)
  {
    item: {
      id: 'item-vader',
      languageId: dutchLanguage.id,
      lessonId: 'les-dutch-005',
      kind: 'vocabulary',
      prompt: 'father',
      skillDimensions: ['meaning', 'spelling', 'productive-recall'],
      contentState: 'available',
      updatedAt: NOW,
    },
    vocabulary: {
      id: 'vocab-vader',
      learningItemId: 'item-vader',
      targetText: 'vader',
      acceptedAnswers: ['vader', 'de vader', 'papa'],
      alternativeTranslations: ['dad', 'daddy'],
      updatedAt: NOW,
    },
    grammarInfo: {
      id: 'gram-vader',
      learningItemId: 'item-vader',
      partOfSpeech: 'noun',
      dutchArticle: 'de',
      pluralForm: 'vaders',
      presentTenseConjugation: null,
      updatedAt: NOW,
    },
    examples: [
      {
        id: 'ex-vader-1',
        learningItemId: 'item-vader',
        sentenceTarget: 'Mijn vader werkt in Amsterdam.',
        sentenceExplanation: 'My father works in Amsterdam.',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
    exercises: [
      {
        id: 'exer-vader-1',
        learningItemId: 'item-vader',
        type: 'flashcard',
        config: {},
        objective: 'Learn the Dutch word for "father"',
        contentState: 'available',
        updatedAt: NOW,
      },
      {
        id: 'exer-vader-2',
        learningItemId: 'item-vader',
        type: 'article-selection',
        config: { testArticle: true, testPlural: true },
        objective: 'Practice the article and plural of "vader"',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
  },
  // de moeder (mother)
  {
    item: {
      id: 'item-moeder',
      languageId: dutchLanguage.id,
      lessonId: 'les-dutch-005',
      kind: 'vocabulary',
      prompt: 'mother',
      skillDimensions: ['meaning', 'spelling', 'productive-recall'],
      contentState: 'available',
      updatedAt: NOW,
    },
    vocabulary: {
      id: 'vocab-moeder',
      learningItemId: 'item-moeder',
      targetText: 'moeder',
      acceptedAnswers: ['moeder', 'de moeder', 'mama', 'mam'],
      alternativeTranslations: ['mom', 'mum', 'mommy'],
      updatedAt: NOW,
    },
    grammarInfo: {
      id: 'gram-moeder',
      learningItemId: 'item-moeder',
      partOfSpeech: 'noun',
      dutchArticle: 'de',
      pluralForm: 'moeders',
      presentTenseConjugation: null,
      updatedAt: NOW,
    },
    examples: [
      {
        id: 'ex-moeder-1',
        learningItemId: 'item-moeder',
        sentenceTarget: 'Mijn moeder kookt lekker.',
        sentenceExplanation: 'My mother cooks well.',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
    exercises: [
      {
        id: 'exer-moeder-1',
        learningItemId: 'item-moeder',
        type: 'flashcard',
        config: {},
        objective: 'Learn the Dutch word for "mother"',
        contentState: 'available',
        updatedAt: NOW,
      },
      {
        id: 'exer-moeder-2',
        learningItemId: 'item-moeder',
        type: 'article-selection',
        config: { testArticle: true },
        objective: 'Practice the article of "moeder"',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
  },
  // het kind (child) - het word example
  {
    item: {
      id: 'item-kind',
      languageId: dutchLanguage.id,
      lessonId: 'les-dutch-005',
      kind: 'vocabulary',
      prompt: 'child',
      skillDimensions: ['meaning', 'spelling', 'productive-recall'],
      contentState: 'available',
      updatedAt: NOW,
    },
    vocabulary: {
      id: 'vocab-kind',
      learningItemId: 'item-kind',
      targetText: 'kind',
      acceptedAnswers: ['kind', 'het kind'],
      alternativeTranslations: ['kid'],
      updatedAt: NOW,
    },
    grammarInfo: {
      id: 'gram-kind',
      learningItemId: 'item-kind',
      partOfSpeech: 'noun',
      dutchArticle: 'het',
      pluralForm: 'kinderen',
      presentTenseConjugation: null,
      updatedAt: NOW,
    },
    examples: [
      {
        id: 'ex-kind-1',
        learningItemId: 'item-kind',
        sentenceTarget: 'Het kind speelt in de tuin.',
        sentenceExplanation: 'The child plays in the garden.',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
    exercises: [
      {
        id: 'exer-kind-1',
        learningItemId: 'item-kind',
        type: 'flashcard',
        config: {},
        objective: 'Learn the Dutch word for "child"',
        contentState: 'available',
        updatedAt: NOW,
      },
      {
        id: 'exer-kind-2',
        learningItemId: 'item-kind',
        type: 'article-selection',
        config: { testArticle: true, testPlural: true },
        objective: 'Practice the article and plural of "kind"',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
  },
];

// --- Verb: zijn (to be) - with conjugation ---

const verbItems: {
  item: LearningItemEntity;
  vocabulary: VocabularyEntity;
  grammarInfo: GrammarInfoEntity;
  examples: ExampleEntity[];
  exercises: ExerciseEntity[];
}[] = [
  {
    item: {
      id: 'item-zijn',
      languageId: dutchLanguage.id,
      lessonId: 'les-dutch-002',
      kind: 'grammar',
      prompt: 'to be',
      skillDimensions: ['meaning', 'spelling', 'productive-recall'],
      contentState: 'available',
      updatedAt: NOW,
    },
    vocabulary: {
      id: 'vocab-zijn',
      learningItemId: 'item-zijn',
      targetText: 'zijn',
      acceptedAnswers: ['zijn'],
      alternativeTranslations: ['be'],
      updatedAt: NOW,
    },
    grammarInfo: {
      id: 'gram-zijn',
      learningItemId: 'item-zijn',
      partOfSpeech: 'verb',
      dutchArticle: null,
      pluralForm: null,
      presentTenseConjugation: {
        ik: 'ben',
        jij: 'bent',
        hij: 'is',
        wij: 'zijn',
        jullie: 'zijn',
        zij: 'zijn',
      },
      updatedAt: NOW,
    },
    examples: [
      {
        id: 'ex-zijn-1',
        learningItemId: 'item-zijn',
        sentenceTarget: 'Ik ben Nederlands.',
        sentenceExplanation: 'I am Dutch.',
        contentState: 'available',
        updatedAt: NOW,
      },
      {
        id: 'ex-zijn-2',
        learningItemId: 'item-zijn',
        sentenceTarget: 'Zij zijn mijn ouders.',
        sentenceExplanation: 'They are my parents.',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
    exercises: [
      {
        id: 'exer-zijn-1',
        learningItemId: 'item-zijn',
        type: 'conjugation',
        config: { forms: ['ik', 'jij', 'hij', 'wij'] },
        objective: 'Practice conjugating "zijn" (to be)',
        contentState: 'available',
        updatedAt: NOW,
      },
      {
        id: 'exer-zijn-2',
        learningItemId: 'item-zijn',
        type: 'fill-blank',
        config: { sentence: 'Ik ___ Nederlands.', answer: 'ben' },
        objective: 'Complete the sentence with the correct form of "zijn"',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
  },
  // hebben (to have)
  {
    item: {
      id: 'item-hebben',
      languageId: dutchLanguage.id,
      lessonId: 'les-dutch-002',
      kind: 'grammar',
      prompt: 'to have',
      skillDimensions: ['meaning', 'spelling', 'productive-recall'],
      contentState: 'available',
      updatedAt: NOW,
    },
    vocabulary: {
      id: 'vocab-hebben',
      learningItemId: 'item-hebben',
      targetText: 'hebben',
      acceptedAnswers: ['hebben'],
      alternativeTranslations: ['have'],
      updatedAt: NOW,
    },
    grammarInfo: {
      id: 'gram-hebben',
      learningItemId: 'item-hebben',
      partOfSpeech: 'verb',
      dutchArticle: null,
      pluralForm: null,
      presentTenseConjugation: {
        ik: 'heb',
        jij: 'hebt',
        hij: 'heeft',
        wij: 'hebben',
        jullie: 'hebben',
        zij: 'hebben',
      },
      updatedAt: NOW,
    },
    examples: [
      {
        id: 'ex-hebben-1',
        learningItemId: 'item-hebben',
        sentenceTarget: 'Ik heb een broer.',
        sentenceExplanation: 'I have a brother.',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
    exercises: [
      {
        id: 'exer-hebben-1',
        learningItemId: 'item-hebben',
        type: 'conjugation',
        config: { forms: ['ik', 'jij', 'hij', 'wij'] },
        objective: 'Practice conjugating "hebben" (to have)',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
  },
];

// --- Numbers 1-10 ---

const numberItems: {
  item: LearningItemEntity;
  vocabulary: VocabularyEntity;
  examples: ExampleEntity[];
  exercises: ExerciseEntity[];
}[] = [
  { word: 'een', meaning: 'one', num: 1 },
  { word: 'twee', meaning: 'two', num: 2 },
  { word: 'drie', meaning: 'three', num: 3 },
  { word: 'vier', meaning: 'four', num: 4 },
  { word: 'vijf', meaning: 'five', num: 5 },
  { word: 'zes', meaning: 'six', num: 6 },
  { word: 'zeven', meaning: 'seven', num: 7 },
  { word: 'acht', meaning: 'eight', num: 8 },
  { word: 'negen', meaning: 'nine', num: 9 },
  { word: 'tien', meaning: 'ten', num: 10 },
].map(({ word, meaning, num }) => ({
  item: {
    id: `item-num-${word}`,
    languageId: dutchLanguage.id,
    lessonId: 'les-dutch-003',
    kind: 'vocabulary' as const,
    prompt: meaning,
    skillDimensions: ['meaning', 'spelling', 'listening-recognition'] as const,
    contentState: 'available' as const,
    updatedAt: NOW,
  },
  vocabulary: {
    id: `vocab-num-${word}`,
    learningItemId: `item-num-${word}`,
    targetText: word,
    acceptedAnswers: [word, String(num)],
    alternativeTranslations: [],
    updatedAt: NOW,
  },
  examples: [
    {
      id: `ex-num-${word}-1`,
      learningItemId: `item-num-${word}`,
      sentenceTarget: `Ik heb ${word} ${num === 1 ? 'kind' : 'kinderen'}.`,
      sentenceExplanation: `I have ${meaning} ${num === 1 ? 'child' : 'children'}.`,
      contentState: 'available' as const,
      updatedAt: NOW,
    },
  ],
  exercises: [
    {
      id: `exer-num-${word}-1`,
      learningItemId: `item-num-${word}`,
      type: 'flashcard' as const,
      config: {},
      objective: `Learn the Dutch number ${meaning}`,
      contentState: 'available' as const,
      updatedAt: NOW,
    },
    {
      id: `exer-num-${word}-2`,
      learningItemId: `item-num-${word}`,
      type: 'typed-translation' as const,
      config: {},
      objective: `Spell the Dutch number ${meaning}`,
      contentState: 'available' as const,
      updatedAt: NOW,
    },
  ],
}));

// ============================================================================
// Export all content
// ============================================================================

export const dutchLearningItems: LearningItemEntity[] = [
  ...greetingItems.map(i => i.item),
  ...familyItems.map(i => i.item),
  ...verbItems.map(i => i.item),
  ...numberItems.map(i => i.item),
];

export const dutchVocabulary: VocabularyEntity[] = [
  ...greetingItems.map(i => i.vocabulary),
  ...familyItems.map(i => i.vocabulary),
  ...verbItems.map(i => i.vocabulary),
  ...numberItems.map(i => i.vocabulary),
];

export const dutchGrammarInfo: GrammarInfoEntity[] = [
  ...familyItems.map(i => i.grammarInfo),
  ...verbItems.map(i => i.grammarInfo),
];

export const dutchExamples: ExampleEntity[] = [
  ...greetingItems.flatMap(i => i.examples),
  ...familyItems.flatMap(i => i.examples),
  ...verbItems.flatMap(i => i.examples),
  ...numberItems.flatMap(i => i.examples),
];

export const dutchExercises: ExerciseEntity[] = [
  ...greetingItems.flatMap(i => i.exercises),
  ...familyItems.flatMap(i => i.exercises),
  ...verbItems.flatMap(i => i.exercises),
  ...numberItems.flatMap(i => i.exercises),
];

/**
 * All Dutch A1 content bundled for seeding.
 */
export const dutchA1Content = {
  language: dutchLanguage,
  modules: dutchModules,
  lessons: dutchLessons,
  learningItems: dutchLearningItems,
  vocabulary: dutchVocabulary,
  grammarInfo: dutchGrammarInfo,
  examples: dutchExamples,
  exercises: dutchExercises,
};
