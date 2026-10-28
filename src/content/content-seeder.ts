/**
 * Content Seeder
 * 
 * Seeds the database with initial content data.
 * 
 * @module content/content-seeder
 */

import type { Repositories } from '../persistence';
import { dutchA1Content } from './data/dutch-a1-content';
import { frenchB2ValidationContent } from './data/french-b2-validation';

/**
 * Seed the database with Dutch A1 content.
 */
export async function seedDutchA1Content(repos: Repositories): Promise<void> {
  const content = dutchA1Content;

  await repos.languages.save(content.language);
  await repos.modules.saveMany(content.modules);
  await repos.lessons.saveMany(content.lessons);
  await repos.learningItems.saveMany(content.learningItems);
  await repos.vocabulary.saveMany(content.vocabulary);
  await repos.grammarInfo.saveMany(content.grammarInfo);
  await repos.examples.saveMany(content.examples);
  await repos.exercises.saveMany(content.exercises);
}

/**
 * Seed the database with French B2 validation content.
 * This content is flagged as a validation asset and should never be presented to learners.
 */
export async function seedFrenchB2ValidationContent(repos: Repositories): Promise<void> {
  const content = frenchB2ValidationContent;

  await repos.languages.save(content.language);
  await repos.modules.saveMany(content.modules);
  await repos.lessons.saveMany(content.lessons);
  await repos.learningItems.saveMany(content.learningItems);
  await repos.vocabulary.saveMany(content.vocabulary);
  // No grammar info for validation set
  await repos.examples.saveMany(content.examples);
  await repos.exercises.saveMany(content.exercises);
}

/**
 * Seed all initial content.
 */
export async function seedAllContent(repos: Repositories): Promise<void> {
  await seedDutchA1Content(repos);
  await seedFrenchB2ValidationContent(repos);
}

/**
 * Check if content has been seeded.
 */
export async function isContentSeeded(repos: Repositories): Promise<boolean> {
  const languageCount = await repos.languages.count();
  return languageCount > 0;
}
