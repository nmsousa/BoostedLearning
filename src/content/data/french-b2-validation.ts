/**
 * French B2 Validation Set
 * 
 * A curated set of French B2 items for testing the Answer_Validator.
 * Exercises accents, contractions, inflections, and alternative translations.
 * 
 * This is a VALIDATION ASSET (R11.3):
 * - Flagged with isValidationAsset = true
 * - Never presented as a course to learners
 * - Used only for automated testing of Answer_Validator behavior
 * 
 * @module content/data/french-b2-validation
 */

import type {
  LanguageEntity,
  ModuleEntity,
  LessonEntity,
  LearningItemEntity,
  VocabularyEntity,
  ExampleEntity,
  ExerciseEntity,
} from '../../persistence/entities';

const NOW = new Date().toISOString();

// ============================================================================
// Language (Validation Asset)
// ============================================================================

export const frenchValidationLanguage: LanguageEntity = {
  id: 'lang-french-validation',
  code: 'fr',
  name: 'French (Validation)',
  isValidationAsset: true, // R11.3: Never surfaced as a course
  updatedAt: NOW,
};

// ============================================================================
// Module (Validation)
// ============================================================================

export const frenchValidationModule: ModuleEntity = {
  id: 'mod-french-validation',
  languageId: frenchValidationLanguage.id,
  order: 1,
  title: 'Answer Validator Test Cases',
  cefrObjective: 'B2',
  updatedAt: NOW,
};

// ============================================================================
// Lessons (Test Categories)
// ============================================================================

export const frenchValidationLessons: LessonEntity[] = [
  {
    id: 'les-fr-val-accents',
    moduleId: frenchValidationModule.id,
    order: 1,
    title: 'Accent Handling',
    cefrObjective: 'B2',
    grammarExplanationId: null,
    updatedAt: NOW,
  },
  {
    id: 'les-fr-val-contractions',
    moduleId: frenchValidationModule.id,
    order: 2,
    title: 'Contractions',
    cefrObjective: 'B2',
    grammarExplanationId: null,
    updatedAt: NOW,
  },
  {
    id: 'les-fr-val-alternatives',
    moduleId: frenchValidationModule.id,
    order: 3,
    title: 'Alternative Translations',
    cefrObjective: 'B2',
    grammarExplanationId: null,
    updatedAt: NOW,
  },
];

// ============================================================================
// Test Items: Accents (R11.1)
// ============================================================================

/**
 * Words with various French accents to test accent tolerance.
 */
const accentItems: {
  item: LearningItemEntity;
  vocabulary: VocabularyEntity;
  examples: ExampleEntity[];
  exercises: ExerciseEntity[];
}[] = [
  // café - acute accent
  {
    item: {
      id: 'item-fr-cafe',
      languageId: frenchValidationLanguage.id,
      lessonId: 'les-fr-val-accents',
      kind: 'vocabulary',
      prompt: 'coffee / café',
      skillDimensions: ['meaning', 'spelling'],
      contentState: 'available',
      updatedAt: NOW,
    },
    vocabulary: {
      id: 'vocab-fr-cafe',
      learningItemId: 'item-fr-cafe',
      targetText: 'café',
      acceptedAnswers: ['café', 'cafe'], // Test: cafe should match café with accent tolerance
      alternativeTranslations: ['coffee shop'],
      updatedAt: NOW,
    },
    examples: [
      {
        id: 'ex-fr-cafe-1',
        learningItemId: 'item-fr-cafe',
        sentenceTarget: 'Je prends un café tous les matins.',
        sentenceExplanation: 'I have a coffee every morning.',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
    exercises: [
      {
        id: 'exer-fr-cafe-1',
        learningItemId: 'item-fr-cafe',
        type: 'typed-translation',
        config: {},
        objective: 'Test accent tolerance',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
  },
  // résumé - multiple accents
  {
    item: {
      id: 'item-fr-resume',
      languageId: frenchValidationLanguage.id,
      lessonId: 'les-fr-val-accents',
      kind: 'vocabulary',
      prompt: 'summary',
      skillDimensions: ['meaning', 'spelling'],
      contentState: 'available',
      updatedAt: NOW,
    },
    vocabulary: {
      id: 'vocab-fr-resume',
      learningItemId: 'item-fr-resume',
      targetText: 'résumé',
      acceptedAnswers: ['résumé', 'resume'], // Test: resume should match résumé
      alternativeTranslations: ['abstract', 'CV'],
      updatedAt: NOW,
    },
    examples: [
      {
        id: 'ex-fr-resume-1',
        learningItemId: 'item-fr-resume',
        sentenceTarget: 'Voici le résumé du livre.',
        sentenceExplanation: 'Here is the summary of the book.',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
    exercises: [
      {
        id: 'exer-fr-resume-1',
        learningItemId: 'item-fr-resume',
        type: 'typed-translation',
        config: {},
        objective: 'Test multiple accent tolerance',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
  },
  // naïve - diaeresis
  {
    item: {
      id: 'item-fr-naive',
      languageId: frenchValidationLanguage.id,
      lessonId: 'les-fr-val-accents',
      kind: 'vocabulary',
      prompt: 'naive',
      skillDimensions: ['meaning', 'spelling'],
      contentState: 'available',
      updatedAt: NOW,
    },
    vocabulary: {
      id: 'vocab-fr-naive',
      learningItemId: 'item-fr-naive',
      targetText: 'naïve',
      acceptedAnswers: ['naïve', 'naive'],
      alternativeTranslations: ['innocent', 'simple'],
      updatedAt: NOW,
    },
    examples: [
      {
        id: 'ex-fr-naive-1',
        learningItemId: 'item-fr-naive',
        sentenceTarget: "Elle est un peu naïve.",
        sentenceExplanation: 'She is a bit naive.',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
    exercises: [
      {
        id: 'exer-fr-naive-1',
        learningItemId: 'item-fr-naive',
        type: 'typed-translation',
        config: {},
        objective: 'Test diaeresis tolerance',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
  },
  // français - cedilla
  {
    item: {
      id: 'item-fr-francais',
      languageId: frenchValidationLanguage.id,
      lessonId: 'les-fr-val-accents',
      kind: 'vocabulary',
      prompt: 'French (language)',
      skillDimensions: ['meaning', 'spelling'],
      contentState: 'available',
      updatedAt: NOW,
    },
    vocabulary: {
      id: 'vocab-fr-francais',
      learningItemId: 'item-fr-francais',
      targetText: 'français',
      acceptedAnswers: ['français', 'francais'],
      alternativeTranslations: ['Frenchman'],
      updatedAt: NOW,
    },
    examples: [
      {
        id: 'ex-fr-francais-1',
        learningItemId: 'item-fr-francais',
        sentenceTarget: 'Je parle français couramment.',
        sentenceExplanation: 'I speak French fluently.',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
    exercises: [
      {
        id: 'exer-fr-francais-1',
        learningItemId: 'item-fr-francais',
        type: 'typed-translation',
        config: {},
        objective: 'Test cedilla tolerance',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
  },
];

// ============================================================================
// Test Items: Contractions (R11.2)
// ============================================================================

const contractionItems: {
  item: LearningItemEntity;
  vocabulary: VocabularyEntity;
  examples: ExampleEntity[];
  exercises: ExerciseEntity[];
}[] = [
  // c'est
  {
    item: {
      id: 'item-fr-cest',
      languageId: frenchValidationLanguage.id,
      lessonId: 'les-fr-val-contractions',
      kind: 'phrase',
      prompt: "it is / that's",
      skillDimensions: ['meaning', 'spelling'],
      contentState: 'available',
      updatedAt: NOW,
    },
    vocabulary: {
      id: 'vocab-fr-cest',
      learningItemId: 'item-fr-cest',
      targetText: "c'est",
      acceptedAnswers: ["c'est", 'cest', 'ce est'], // Test: should accept with/without apostrophe
      alternativeTranslations: ["it's", 'this is'],
      updatedAt: NOW,
    },
    examples: [
      {
        id: 'ex-fr-cest-1',
        learningItemId: 'item-fr-cest',
        sentenceTarget: "C'est magnifique!",
        sentenceExplanation: "It's magnificent!",
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
    exercises: [
      {
        id: 'exer-fr-cest-1',
        learningItemId: 'item-fr-cest',
        type: 'typed-translation',
        config: {},
        objective: 'Test contraction with apostrophe',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
  },
  // j'ai
  {
    item: {
      id: 'item-fr-jai',
      languageId: frenchValidationLanguage.id,
      lessonId: 'les-fr-val-contractions',
      kind: 'phrase',
      prompt: 'I have',
      skillDimensions: ['meaning', 'spelling'],
      contentState: 'available',
      updatedAt: NOW,
    },
    vocabulary: {
      id: 'vocab-fr-jai',
      learningItemId: 'item-fr-jai',
      targetText: "j'ai",
      acceptedAnswers: ["j'ai", 'jai', 'je ai'],
      alternativeTranslations: ["I've"],
      updatedAt: NOW,
    },
    examples: [
      {
        id: 'ex-fr-jai-1',
        learningItemId: 'item-fr-jai',
        sentenceTarget: "J'ai vingt ans.",
        sentenceExplanation: 'I am twenty years old.',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
    exercises: [
      {
        id: 'exer-fr-jai-1',
        learningItemId: 'item-fr-jai',
        type: 'typed-translation',
        config: {},
        objective: 'Test j/je contraction',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
  },
  // l'homme
  {
    item: {
      id: 'item-fr-lhomme',
      languageId: frenchValidationLanguage.id,
      lessonId: 'les-fr-val-contractions',
      kind: 'vocabulary',
      prompt: 'the man',
      skillDimensions: ['meaning', 'spelling'],
      contentState: 'available',
      updatedAt: NOW,
    },
    vocabulary: {
      id: 'vocab-fr-lhomme',
      learningItemId: 'item-fr-lhomme',
      targetText: "l'homme",
      acceptedAnswers: ["l'homme", 'lhomme', 'le homme', 'homme'],
      alternativeTranslations: ['man', 'mankind'],
      updatedAt: NOW,
    },
    examples: [
      {
        id: 'ex-fr-lhomme-1',
        learningItemId: 'item-fr-lhomme',
        sentenceTarget: "L'homme marche dans la rue.",
        sentenceExplanation: 'The man walks in the street.',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
    exercises: [
      {
        id: 'exer-fr-lhomme-1',
        learningItemId: 'item-fr-lhomme',
        type: 'typed-translation',
        config: {},
        objective: 'Test article contraction',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
  },
];

// ============================================================================
// Test Items: Alternative Translations (R8.5)
// ============================================================================

const alternativeItems: {
  item: LearningItemEntity;
  vocabulary: VocabularyEntity;
  examples: ExampleEntity[];
  exercises: ExerciseEntity[];
}[] = [
  // maison - house/home
  {
    item: {
      id: 'item-fr-maison',
      languageId: frenchValidationLanguage.id,
      lessonId: 'les-fr-val-alternatives',
      kind: 'vocabulary',
      prompt: 'house/home',
      skillDimensions: ['meaning', 'spelling'],
      contentState: 'available',
      updatedAt: NOW,
    },
    vocabulary: {
      id: 'vocab-fr-maison',
      learningItemId: 'item-fr-maison',
      targetText: 'maison',
      acceptedAnswers: ['maison', 'la maison'],
      alternativeTranslations: ['house', 'home', 'household', 'dwelling'],
      updatedAt: NOW,
    },
    examples: [
      {
        id: 'ex-fr-maison-1',
        learningItemId: 'item-fr-maison',
        sentenceTarget: 'Je rentre à la maison.',
        sentenceExplanation: "I'm going home.",
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
    exercises: [
      {
        id: 'exer-fr-maison-1',
        learningItemId: 'item-fr-maison',
        type: 'typed-translation',
        config: {},
        objective: 'Test multiple valid translations',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
  },
  // travail - work/job
  {
    item: {
      id: 'item-fr-travail',
      languageId: frenchValidationLanguage.id,
      lessonId: 'les-fr-val-alternatives',
      kind: 'vocabulary',
      prompt: 'work/job',
      skillDimensions: ['meaning', 'spelling'],
      contentState: 'available',
      updatedAt: NOW,
    },
    vocabulary: {
      id: 'vocab-fr-travail',
      learningItemId: 'item-fr-travail',
      targetText: 'travail',
      acceptedAnswers: ['travail', 'le travail'],
      alternativeTranslations: ['work', 'job', 'labor', 'employment', 'occupation'],
      updatedAt: NOW,
    },
    examples: [
      {
        id: 'ex-fr-travail-1',
        learningItemId: 'item-fr-travail',
        sentenceTarget: 'Je vais au travail en métro.',
        sentenceExplanation: 'I go to work by metro.',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
    exercises: [
      {
        id: 'exer-fr-travail-1',
        learningItemId: 'item-fr-travail',
        type: 'typed-translation',
        config: {},
        objective: 'Test many alternative translations',
        contentState: 'available',
        updatedAt: NOW,
      },
    ],
  },
];

// ============================================================================
// Export all content
// ============================================================================

export const frenchValidationLearningItems: LearningItemEntity[] = [
  ...accentItems.map(i => i.item),
  ...contractionItems.map(i => i.item),
  ...alternativeItems.map(i => i.item),
];

export const frenchValidationVocabulary: VocabularyEntity[] = [
  ...accentItems.map(i => i.vocabulary),
  ...contractionItems.map(i => i.vocabulary),
  ...alternativeItems.map(i => i.vocabulary),
];

export const frenchValidationExamples: ExampleEntity[] = [
  ...accentItems.flatMap(i => i.examples),
  ...contractionItems.flatMap(i => i.examples),
  ...alternativeItems.flatMap(i => i.examples),
];

export const frenchValidationExercises: ExerciseEntity[] = [
  ...accentItems.flatMap(i => i.exercises),
  ...contractionItems.flatMap(i => i.exercises),
  ...alternativeItems.flatMap(i => i.exercises),
];

/**
 * All French validation content bundled for seeding.
 * This content is a VALIDATION ASSET and should never be presented to learners.
 */
export const frenchB2ValidationContent = {
  language: frenchValidationLanguage,
  modules: [frenchValidationModule],
  lessons: frenchValidationLessons,
  learningItems: frenchValidationLearningItems,
  vocabulary: frenchValidationVocabulary,
  grammarInfo: [], // No grammar info for validation set
  examples: frenchValidationExamples,
  exercises: frenchValidationExercises,
};
