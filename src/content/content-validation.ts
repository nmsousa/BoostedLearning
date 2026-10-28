/**
 * Content Validation Mechanism
 * 
 * Implements the Content_Validation checklist and gate (R12.2, R12.3).
 * Verifies vocabulary, translations, example sentences, conjugations,
 * and alternative answers before allowing transition to `available`.
 * 
 * @module content/content-validation
 */

import type {
  LearningItemEntity,
  VocabularyEntity,
  GrammarInfoEntity,
  ExampleEntity,
  ExerciseEntity,
  LessonEntity,
  ModuleEntity,
} from '../persistence/entities';
import type { ContentValidationResult, ValidationIssue } from './content-state-machine';

/**
 * Comprehensive content data for validation.
 */
export interface ContentForValidation {
  item: LearningItemEntity;
  vocabulary?: VocabularyEntity;
  grammarInfo?: GrammarInfoEntity;
  examples: ExampleEntity[];
  exercises: ExerciseEntity[];
}

/**
 * Lesson content for validation.
 */
export interface LessonForValidation {
  lesson: LessonEntity;
  items: ContentForValidation[];
}

/**
 * Module content for validation.
 */
export interface ModuleForValidation {
  module: ModuleEntity;
  lessons: LessonForValidation[];
}

// ============================================================================
// Vocabulary Validation
// ============================================================================

/**
 * Validate vocabulary item content.
 */
export function validateVocabulary(
  item: LearningItemEntity,
  vocabulary: VocabularyEntity | undefined
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (item.kind !== 'vocabulary') {
    return issues;
  }

  if (!vocabulary) {
    issues.push({
      field: 'vocabulary',
      message: 'Vocabulary item is missing vocabulary data',
      severity: 'error',
    });
    return issues;
  }

  // Check target text
  if (!vocabulary.targetText || vocabulary.targetText.trim().length === 0) {
    issues.push({
      field: 'vocabulary.targetText',
      message: 'Target text is required',
      severity: 'error',
    });
  }

  // Check accepted answers
  if (!vocabulary.acceptedAnswers || vocabulary.acceptedAnswers.length === 0) {
    issues.push({
      field: 'vocabulary.acceptedAnswers',
      message: 'At least one accepted answer is required',
      severity: 'error',
    });
  } else {
    // Check for empty answers
    const emptyAnswers = vocabulary.acceptedAnswers.filter(a => !a || a.trim().length === 0);
    if (emptyAnswers.length > 0) {
      issues.push({
        field: 'vocabulary.acceptedAnswers',
        message: 'Accepted answers cannot be empty',
        severity: 'error',
      });
    }
  }

  // Check alternative translations (warning if none)
  if (!vocabulary.alternativeTranslations || vocabulary.alternativeTranslations.length === 0) {
    issues.push({
      field: 'vocabulary.alternativeTranslations',
      message: 'Consider adding alternative translations for better coverage',
      severity: 'warning',
    });
  }

  return issues;
}

// ============================================================================
// Grammar Validation (Dutch-specific)
// ============================================================================

/**
 * Validate grammar item content with Dutch-specific fields.
 */
export function validateGrammarInfo(
  item: LearningItemEntity,
  grammarInfo: GrammarInfoEntity | undefined
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (item.kind !== 'grammar' && item.kind !== 'vocabulary') {
    return issues;
  }

  // Grammar info is optional for vocabulary items
  if (!grammarInfo && item.kind === 'grammar') {
    issues.push({
      field: 'grammarInfo',
      message: 'Grammar item is missing grammar info',
      severity: 'error',
    });
    return issues;
  }

  if (!grammarInfo) {
    return issues;
  }

  // Validate part of speech
  if (!grammarInfo.partOfSpeech || grammarInfo.partOfSpeech.trim().length === 0) {
    issues.push({
      field: 'grammarInfo.partOfSpeech',
      message: 'Part of speech is required',
      severity: 'error',
    });
  }

  // Dutch noun validation (R9.1, R9.2)
  if (grammarInfo.partOfSpeech === 'noun') {
    // Dutch article is required for nouns
    if (!grammarInfo.dutchArticle) {
      issues.push({
        field: 'grammarInfo.dutchArticle',
        message: 'Dutch nouns must have an article (de/het)',
        severity: 'error',
      });
    }

    // Plural form is required for nouns
    if (!grammarInfo.pluralForm || grammarInfo.pluralForm.trim().length === 0) {
      issues.push({
        field: 'grammarInfo.pluralForm',
        message: 'Dutch nouns must have a plural form',
        severity: 'error',
      });
    }
  }

  // Dutch verb validation (R9.3)
  if (grammarInfo.partOfSpeech === 'verb') {
    if (!grammarInfo.presentTenseConjugation) {
      issues.push({
        field: 'grammarInfo.presentTenseConjugation',
        message: 'Dutch verbs must have present tense conjugation',
        severity: 'error',
      });
    } else {
      const conj = grammarInfo.presentTenseConjugation;
      const requiredForms = ['ik', 'jij', 'hij', 'wij', 'jullie', 'zij'] as const;
      for (const form of requiredForms) {
        if (!conj[form] || conj[form].trim().length === 0) {
          issues.push({
            field: `grammarInfo.presentTenseConjugation.${form}`,
            message: `Missing conjugation for "${form}"`,
            severity: 'error',
          });
        }
      }
    }
  }

  return issues;
}

// ============================================================================
// Example Validation
// ============================================================================

/**
 * Validate example sentences.
 */
export function validateExamples(examples: ExampleEntity[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (examples.length === 0) {
    issues.push({
      field: 'examples',
      message: 'At least one example sentence is recommended',
      severity: 'warning',
    });
    return issues;
  }

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];

    if (!example.sentenceTarget || example.sentenceTarget.trim().length === 0) {
      issues.push({
        field: `examples[${i}].sentenceTarget`,
        message: 'Example sentence in target language is required',
        severity: 'error',
      });
    }

    if (!example.sentenceExplanation || example.sentenceExplanation.trim().length === 0) {
      issues.push({
        field: `examples[${i}].sentenceExplanation`,
        message: 'Example translation/explanation is required',
        severity: 'error',
      });
    }
  }

  return issues;
}

// ============================================================================
// Exercise Validation
// ============================================================================

/**
 * Validate exercise configuration.
 */
export function validateExercises(exercises: ExerciseEntity[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (exercises.length === 0) {
    issues.push({
      field: 'exercises',
      message: 'At least one exercise is required for learnable content',
      severity: 'warning',
    });
    return issues;
  }

  for (let i = 0; i < exercises.length; i++) {
    const exercise = exercises[i];

    // Check objective is defined (R7.2)
    if (!exercise.objective || exercise.objective.trim().length === 0) {
      issues.push({
        field: `exercises[${i}].objective`,
        message: 'Exercise objective is required',
        severity: 'error',
      });
    }

    // Check type is valid
    if (!exercise.type) {
      issues.push({
        field: `exercises[${i}].type`,
        message: 'Exercise type is required',
        severity: 'error',
      });
    }
  }

  return issues;
}

// ============================================================================
// Lesson/Module Validation
// ============================================================================

/**
 * Validate lesson structure.
 */
export function validateLesson(lesson: LessonEntity): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!lesson.title || lesson.title.trim().length === 0) {
    issues.push({
      field: 'lesson.title',
      message: 'Lesson title is required',
      severity: 'error',
    });
  }

  // CEFR objective required (R10.1)
  if (!lesson.cefrObjective || lesson.cefrObjective.trim().length === 0) {
    issues.push({
      field: 'lesson.cefrObjective',
      message: 'Lesson must have a CEFR-aligned objective',
      severity: 'error',
    });
  } else if (!isValidCefrLevel(lesson.cefrObjective)) {
    issues.push({
      field: 'lesson.cefrObjective',
      message: `Invalid CEFR level: ${lesson.cefrObjective}. Must be A1, A2, B1, B2, C1, or C2`,
      severity: 'warning',
    });
  }

  return issues;
}

/**
 * Validate module structure.
 */
export function validateModule(module: ModuleEntity): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!module.title || module.title.trim().length === 0) {
    issues.push({
      field: 'module.title',
      message: 'Module title is required',
      severity: 'error',
    });
  }

  // CEFR objective required
  if (!module.cefrObjective || module.cefrObjective.trim().length === 0) {
    issues.push({
      field: 'module.cefrObjective',
      message: 'Module must have a CEFR-aligned objective',
      severity: 'error',
    });
  }

  return issues;
}

/**
 * Check if a CEFR level is valid.
 */
function isValidCefrLevel(level: string): boolean {
  const validLevels = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  // Allow sub-levels like A1.1, A1.2
  const baseLevel = level.split('.')[0].toUpperCase();
  return validLevels.includes(baseLevel);
}

// ============================================================================
// Complete Content Validation
// ============================================================================

/**
 * Validate all aspects of a learning item and its related content.
 */
export function validateContent(content: ContentForValidation): ContentValidationResult {
  const allIssues: ValidationIssue[] = [];

  // Validate learning item basics
  if (!content.item.prompt || content.item.prompt.trim().length === 0) {
    allIssues.push({
      field: 'item.prompt',
      message: 'Learning item prompt is required',
      severity: 'error',
    });
  }

  if (!content.item.skillDimensions || content.item.skillDimensions.length === 0) {
    allIssues.push({
      field: 'item.skillDimensions',
      message: 'At least one skill dimension is required',
      severity: 'error',
    });
  }

  // Validate based on item kind
  if (content.item.kind === 'vocabulary') {
    allIssues.push(...validateVocabulary(content.item, content.vocabulary));
    // Grammar info is optional for vocabulary but good to have for nouns/verbs
    if (content.grammarInfo) {
      allIssues.push(...validateGrammarInfo(content.item, content.grammarInfo));
    }
  } else if (content.item.kind === 'grammar') {
    allIssues.push(...validateGrammarInfo(content.item, content.grammarInfo));
  }

  // Validate examples
  allIssues.push(...validateExamples(content.examples));

  // Validate exercises
  allIssues.push(...validateExercises(content.exercises));

  const hasErrors = allIssues.some(i => i.severity === 'error');

  return {
    valid: !hasErrors,
    issues: allIssues,
  };
}

/**
 * Validate a complete lesson with all its items.
 */
export function validateLessonContent(lesson: LessonForValidation): ContentValidationResult {
  const allIssues: ValidationIssue[] = [];

  // Validate lesson structure
  allIssues.push(...validateLesson(lesson.lesson));

  // Validate each item
  for (const itemContent of lesson.items) {
    const itemResult = validateContent(itemContent);
    // Prefix issues with item info
    for (const issue of itemResult.issues) {
      allIssues.push({
        ...issue,
        field: `item[${itemContent.item.id}].${issue.field}`,
      });
    }
  }

  // Check lesson has at least one item
  if (lesson.items.length === 0) {
    allIssues.push({
      field: 'lesson.items',
      message: 'Lesson must have at least one learning item',
      severity: 'error',
    });
  }

  const hasErrors = allIssues.some(i => i.severity === 'error');

  return {
    valid: !hasErrors,
    issues: allIssues,
  };
}

/**
 * Validate a complete module with all its lessons.
 */
export function validateModuleContent(module: ModuleForValidation): ContentValidationResult {
  const allIssues: ValidationIssue[] = [];

  // Validate module structure
  allIssues.push(...validateModule(module.module));

  // Validate each lesson
  for (const lessonContent of module.lessons) {
    const lessonResult = validateLessonContent(lessonContent);
    // Prefix issues with lesson info
    for (const issue of lessonResult.issues) {
      allIssues.push({
        ...issue,
        field: `lesson[${lessonContent.lesson.id}].${issue.field}`,
      });
    }
  }

  // Check module has at least one lesson
  if (module.lessons.length === 0) {
    allIssues.push({
      field: 'module.lessons',
      message: 'Module must have at least one lesson',
      severity: 'error',
    });
  }

  const hasErrors = allIssues.some(i => i.severity === 'error');

  return {
    valid: !hasErrors,
    issues: allIssues,
  };
}
