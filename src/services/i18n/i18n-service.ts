/**
 * i18n (Internationalization) Service
 * 
 * Provides localized strings for explanations and UI text.
 * Supports Portuguese (default), French, and English.
 * Missing keys fall back to Portuguese.
 * 
 * Requirements: 16.1, 16.2, 16.3
 * Design: Presentation & i18n
 * 
 * @module services/i18n
 */

/**
 * Supported explanation languages
 */
export type ExplanationLanguage = 'pt' | 'fr' | 'en' | 'es';

/**
 * Default explanation language (Portuguese as per requirements)
 */
export const DEFAULT_EXPLANATION_LANGUAGE: ExplanationLanguage = 'pt';

/**
 * i18n message catalog type
 */
export interface MessageCatalog {
  [key: string]: string;
}

/**
 * i18n Service interface
 */
export interface I18nService {
  /**
   * Get the current explanation language
   */
  getLanguage(): ExplanationLanguage;
  
  /**
   * Set the explanation language (runtime switch)
   */
  setLanguage(lang: ExplanationLanguage): void;
  
  /**
   * Get a localized string by key.
   * Falls back to Portuguese if key is missing in current language.
   */
  t(key: string, params?: Record<string, string | number>): string;
  
  /**
   * Check if a key exists in the current language
   */
  hasKey(key: string): boolean;
  
  /**
   * Check if a key exists in a specific language
   */
  hasKeyIn(key: string, lang: ExplanationLanguage): boolean;
  
  /**
   * Get all available languages
   */
  getAvailableLanguages(): ExplanationLanguage[];
}

/**
 * Portuguese message catalog (default/fallback)
 */
const PT_MESSAGES: MessageCatalog = {
  // Common UI
  'common.continue': 'Continuar',
  'common.back': 'Voltar',
  'common.next': 'Próximo',
  'common.submit': 'Enviar',
  'common.skip': 'Pular',
  'common.cancel': 'Cancelar',
  'common.save': 'Salvar',
  'common.delete': 'Excluir',
  'common.edit': 'Editar',
  'common.close': 'Fechar',
  'common.loading': 'Carregando...',
  'common.error': 'Erro',
  'common.success': 'Sucesso',
  'common.retry': 'Tentar novamente',
  
  // Exercise feedback
  'feedback.correct': 'Correto!',
  'feedback.incorrect': 'Incorreto',
  'feedback.almost': 'Quase certo!',
  'feedback.tryAgain': 'Tentar novamente',
  'feedback.showAnswer': 'Ver resposta',
  'feedback.correctAnswer': 'A resposta correta é: {answer}',
  'feedback.almostCorrect': 'Quase! A resposta correta é: {answer}',
  'feedback.youTyped': 'Você escreveu:',
  
  // Feedback insights
  'feedback.insight.alternativeUsed': '"{word}" é uma tradução válida, mas aqui esperávamos "{correct}".',
  'feedback.insight.promptTyped': 'Você digitou a pergunta em vez da tradução.',
  'feedback.insight.wrongDirection': 'Você digitou a palavra no idioma errado. Tente traduzir.',
  'feedback.insight.closeToAlternative': 'Sua resposta é parecida com "{word}", mas esperávamos "{correct}".',
  'feedback.insight.multipleAnswers': 'Respostas aceitas: {answers}',
  'feedback.insight.dutch.ijVsEi': 'Cuidado: "ij" e "ei" soam parecido em holandês, mas são escritos diferente.',
  'feedback.insight.dutch.eiVsIj': 'Cuidado: "ei" e "ij" soam parecido em holandês, mas são escritos diferente.',
  'feedback.insight.dutch.ouVsAu': 'Cuidado: "ou" e "au" soam igual em holandês.',
  'feedback.insight.dutch.auVsOu': 'Cuidado: "au" e "ou" soam igual em holandês.',
  'feedback.insight.dutch.gVsCh': 'Cuidado: "g" e "ch" têm sons parecidos em holandês.',
  'feedback.insight.dutch.dtEnding': 'Lembre-se: verbos na 2ª/3ª pessoa podem terminar em "-dt".',
  
  // Exercise instructions
  'exercise.translate': 'Traduza para {language}',
  'exercise.selectCorrect': 'Selecione a opção correta',
  'exercise.fillBlank': 'Preencha o espaço em branco',
  'exercise.matchWords': 'Combine as palavras',
  'exercise.typeAnswer': 'Digite sua resposta',
  'exercise.listenAndType': 'Escute e digite',
  'exercise.reorderWords': 'Reorganize as palavras',
  'exercise.selectArticle': 'Selecione o artigo correto',
  'exercise.conjugateVerb': 'Conjugue o verbo',
  
  // Grammar explanations
  'grammar.article.de': '"De" é usado para palavras masculinas e femininas no plural e para a maioria das palavras femininas no singular.',
  'grammar.article.het': '"Het" é usado para palavras neutras.',
  'grammar.plural.info': 'Os plurais em holandês geralmente terminam em "-en" ou "-s".',
  'grammar.conjugation.present': 'Conjugação no presente',
  
  // Session
  'session.start': 'Iniciar sessão',
  'session.end': 'Encerrar sessão',
  'session.pause': 'Pausar',
  'session.resume': 'Continuar',
  'session.complete': 'Sessão concluída!',
  'session.itemsStudied': '{count} itens estudados',
  'session.accuracy': '{percent}% de precisão',
  
  // Progress
  'progress.title': 'Seu progresso',
  'progress.itemsLearned': 'Itens aprendidos',
  'progress.dueToday': 'Para revisar hoje',
  'progress.streak': 'Sequência atual',
  'progress.totalTime': 'Tempo total de estudo',
  
  // Recovery
  'recovery.title': 'Recuperação',
  'recovery.forgottenItems': 'Itens que precisam de mais prática',
  'recovery.inRecovery': 'Em recuperação',
  
  // Settings
  'settings.title': 'Configurações',
  'settings.language': 'Idioma das explicações',
  'settings.theme': 'Tema',
  'settings.theme.light': 'Claro',
  'settings.theme.dark': 'Escuro',
  'settings.audioSpeed': 'Velocidade do áudio',
  'settings.textSize': 'Tamanho do texto',
  
  // Audio
  'audio.play': 'Reproduzir áudio',
  'audio.slowDown': 'Reproduzir mais devagar',
  'audio.unavailable': 'Áudio não disponível para este idioma',
  
  // Hints
  'hint.show': 'Mostrar dica',
  'hint.available': 'Dica disponível',
  
  // Review reasons
  'review.reason.new': 'Novo item',
  'review.reason.due': 'Revisão programada',
  'review.reason.recovery': 'Em recuperação',

  // Home / practice modes
  'home.continueLearning': 'Continuar a aprender',
  'home.comingSoon': 'Brevemente',
  'home.practice': 'Praticar',
  'home.mode.flashcards': 'Cartões',
  'home.mode.flashcards.desc': 'Vira e autoavalia-te',
  'home.mode.write': 'Escrever',
  'home.mode.write.desc': 'Escreve a tradução',
  'home.mode.match': 'Associar',
  'home.mode.match.desc': 'Liga os pares',
  'home.mode.quiz': 'Quiz',
  'home.mode.quiz.desc': 'Escolha múltipla',
  'home.yourWords': 'As tuas palavras',
  'home.studied': '{count} estudadas',
  'home.level.learning': 'A aprender',
  'home.level.familiar': 'Familiar',
  'home.level.known': 'Sabida',
  'home.wordsEmpty': 'Estuda algumas palavras e aparecerão aqui como A aprender, Familiar ou Sabida.',
  'home.welcome': 'Bem-vindo ao BoostedLearning',
  'home.courseComingSoon': 'O curso guiado chega em breve. Experimenta os modos de prática acima para começar.',

  // Your words detail screen
  'words.title': 'As tuas palavras',
  'words.all': 'Todas',
  'words.empty': 'Ainda não há palavras praticadas. Joga um modo e as tuas palavras aparecem aqui.',

  // Practice (level list)
  'practice.loading': 'A carregar...',
  'practice.addVocab': 'Adiciona vocabulário em Definições → Vocabulário para começar a praticar.',
  'practice.builtin': 'Incluído',
  'practice.custom': 'Personalizado',
  'practice.customCards': '{count} personalizadas',
  'practice.countSummary': '{words} palavras · {levels} níveis',
  'practice.level': 'Nível {n}',
  'practice.levelWords': '{count} palavras',
  'practice.unlockHint': 'Faz 70% no nível anterior para desbloquear',
  'practice.quickStudy': 'Estudo rápido',
};

/**
 * French message catalog
 */
const FR_MESSAGES: MessageCatalog = {
  // Common UI
  'common.continue': 'Continuer',
  'common.back': 'Retour',
  'common.next': 'Suivant',
  'common.submit': 'Envoyer',
  'common.skip': 'Passer',
  'common.cancel': 'Annuler',
  'common.save': 'Enregistrer',
  'common.delete': 'Supprimer',
  'common.edit': 'Modifier',
  'common.close': 'Fermer',
  'common.loading': 'Chargement...',
  'common.error': 'Erreur',
  'common.success': 'Succès',
  'common.retry': 'Réessayer',
  
  // Exercise feedback
  'feedback.correct': 'Correct !',
  'feedback.incorrect': 'Incorrect',
  'feedback.almost': 'Presque correct !',
  'feedback.tryAgain': 'Réessayer',
  'feedback.showAnswer': 'Voir la réponse',
  'feedback.correctAnswer': 'La bonne réponse est : {answer}',
  'feedback.almostCorrect': 'Presque ! La bonne réponse est : {answer}',
  'feedback.youTyped': 'Vous avez écrit :',
  
  // Feedback insights
  'feedback.insight.alternativeUsed': '"{word}" est une traduction valide, mais ici nous attendions "{correct}".',
  'feedback.insight.promptTyped': 'Vous avez tapé la question au lieu de la traduction.',
  'feedback.insight.wrongDirection': 'Vous avez tapé le mot dans la mauvaise langue. Essayez de traduire.',
  'feedback.insight.closeToAlternative': 'Votre réponse ressemble à "{word}", mais nous attendions "{correct}".',
  'feedback.insight.multipleAnswers': 'Réponses acceptées : {answers}',
  'feedback.insight.dutch.ijVsEi': 'Attention : "ij" et "ei" sonnent pareil en néerlandais, mais s\'écrivent différemment.',
  'feedback.insight.dutch.eiVsIj': 'Attention : "ei" et "ij" sonnent pareil en néerlandais, mais s\'écrivent différemment.',
  'feedback.insight.dutch.ouVsAu': 'Attention : "ou" et "au" sonnent pareil en néerlandais.',
  'feedback.insight.dutch.auVsOu': 'Attention : "au" et "ou" sonnent pareil en néerlandais.',
  'feedback.insight.dutch.gVsCh': 'Attention : "g" et "ch" ont des sons similaires en néerlandais.',
  'feedback.insight.dutch.dtEnding': 'Rappel : les verbes à la 2e/3e personne peuvent se terminer par "-dt".',
  
  // Exercise instructions
  'exercise.translate': 'Traduisez en {language}',
  'exercise.selectCorrect': 'Sélectionnez la bonne réponse',
  'exercise.fillBlank': 'Remplissez le blanc',
  'exercise.matchWords': 'Associez les mots',
  'exercise.typeAnswer': 'Tapez votre réponse',
  'exercise.listenAndType': 'Écoutez et tapez',
  'exercise.reorderWords': 'Réorganisez les mots',
  'exercise.selectArticle': 'Sélectionnez le bon article',
  'exercise.conjugateVerb': 'Conjuguez le verbe',
  
  // Grammar explanations
  'grammar.article.de': '"De" est utilisé pour les mots masculins et féminins au pluriel et pour la plupart des mots féminins au singulier.',
  'grammar.article.het': '"Het" est utilisé pour les mots neutres.',
  'grammar.plural.info': 'Les pluriels en néerlandais se terminent généralement par "-en" ou "-s".',
  'grammar.conjugation.present': 'Conjugaison au présent',
  
  // Session
  'session.start': 'Démarrer la session',
  'session.end': 'Terminer la session',
  'session.pause': 'Pause',
  'session.resume': 'Reprendre',
  'session.complete': 'Session terminée !',
  'session.itemsStudied': '{count} éléments étudiés',
  'session.accuracy': '{percent}% de précision',
  
  // Progress
  'progress.title': 'Votre progression',
  'progress.itemsLearned': 'Éléments appris',
  'progress.dueToday': 'À réviser aujourd\'hui',
  'progress.streak': 'Série actuelle',
  'progress.totalTime': 'Temps total d\'étude',
  
  // Recovery
  'recovery.title': 'Récupération',
  'recovery.forgottenItems': 'Éléments nécessitant plus de pratique',
  'recovery.inRecovery': 'En récupération',
  
  // Settings
  'settings.title': 'Paramètres',
  'settings.language': 'Langue des explications',
  'settings.theme': 'Thème',
  'settings.theme.light': 'Clair',
  'settings.theme.dark': 'Sombre',
  'settings.audioSpeed': 'Vitesse audio',
  'settings.textSize': 'Taille du texte',
  
  // Audio
  'audio.play': 'Lire l\'audio',
  'audio.slowDown': 'Lire plus lentement',
  'audio.unavailable': 'Audio non disponible pour cette langue',
  
  // Hints
  'hint.show': 'Afficher l\'indice',
  'hint.available': 'Indice disponible',
  
  // Review reasons
  'review.reason.new': 'Nouvel élément',
  'review.reason.due': 'Révision programmée',
  'review.reason.recovery': 'En récupération',

  // Home / practice modes
  'home.continueLearning': 'Continuer à apprendre',
  'home.comingSoon': 'Bientôt disponible',
  'home.practice': 'Pratiquer',
  'home.mode.flashcards': 'Cartes',
  'home.mode.flashcards.desc': 'Retourne et auto-évalue-toi',
  'home.mode.write': 'Écrire',
  'home.mode.write.desc': 'Tape la traduction',
  'home.mode.match': 'Associer',
  'home.mode.match.desc': 'Relie les paires',
  'home.mode.quiz': 'Quiz',
  'home.mode.quiz.desc': 'Choix multiple',
  'home.yourWords': 'Tes mots',
  'home.studied': '{count} étudiés',
  'home.level.learning': 'En cours',
  'home.level.familiar': 'Familier',
  'home.level.known': 'Maîtrisé',
  'home.wordsEmpty': 'Étudie quelques mots et ils apparaîtront ici en En cours, Familier ou Maîtrisé.',
  'home.welcome': 'Bienvenue sur BoostedLearning',
  'home.courseComingSoon': 'Le cours guidé arrive bientôt. Essaie les modes de pratique ci-dessus pour commencer.',

  // Your words detail screen
  'words.title': 'Tes mots',
  'words.all': 'Tous',
  'words.empty': "Aucun mot pratiqué pour l'instant. Joue à un mode et tes mots apparaîtront ici.",

  // Practice (level list)
  'practice.loading': 'Chargement...',
  'practice.addVocab': 'Ajoute du vocabulaire dans Paramètres → Vocabulaire pour commencer.',
  'practice.builtin': 'Intégré',
  'practice.custom': 'Personnalisé',
  'practice.customCards': '{count} personnalisés',
  'practice.countSummary': '{words} mots · {levels} niveaux',
  'practice.level': 'Niveau {n}',
  'practice.levelWords': '{count} mots',
  'practice.unlockHint': 'Obtiens 70% au niveau précédent pour débloquer',
  'practice.quickStudy': 'Étude rapide',
};

/**
 * English message catalog
 */
const EN_MESSAGES: MessageCatalog = {
  // Common UI
  'common.continue': 'Continue',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.submit': 'Submit',
  'common.skip': 'Skip',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.close': 'Close',
  'common.loading': 'Loading...',
  'common.error': 'Error',
  'common.success': 'Success',
  'common.retry': 'Retry',
  
  // Exercise feedback
  'feedback.correct': 'Correct!',
  'feedback.incorrect': 'Incorrect',
  'feedback.almost': 'Almost correct!',
  'feedback.tryAgain': 'Try again',
  'feedback.showAnswer': 'Show answer',
  'feedback.correctAnswer': 'The correct answer is: {answer}',
  'feedback.almostCorrect': 'Almost! The correct answer is: {answer}',
  'feedback.youTyped': 'You typed:',
  
  // Feedback insights
  'feedback.insight.alternativeUsed': '"{word}" is a valid translation, but here we expected "{correct}".',
  'feedback.insight.promptTyped': 'You typed the question instead of the translation.',
  'feedback.insight.wrongDirection': 'You typed the word in the wrong language. Try translating it.',
  'feedback.insight.closeToAlternative': 'Your answer is similar to "{word}", but we expected "{correct}".',
  'feedback.insight.multipleAnswers': 'Accepted answers: {answers}',
  'feedback.insight.dutch.ijVsEi': 'Note: "ij" and "ei" sound the same in Dutch, but are spelled differently.',
  'feedback.insight.dutch.eiVsIj': 'Note: "ei" and "ij" sound the same in Dutch, but are spelled differently.',
  'feedback.insight.dutch.ouVsAu': 'Note: "ou" and "au" sound the same in Dutch.',
  'feedback.insight.dutch.auVsOu': 'Note: "au" and "ou" sound the same in Dutch.',
  'feedback.insight.dutch.gVsCh': 'Note: "g" and "ch" have similar sounds in Dutch.',
  'feedback.insight.dutch.dtEnding': 'Remember: verbs in 2nd/3rd person may end in "-dt".',
  
  // Exercise instructions
  'exercise.translate': 'Translate to {language}',
  'exercise.selectCorrect': 'Select the correct option',
  'exercise.fillBlank': 'Fill in the blank',
  'exercise.matchWords': 'Match the words',
  'exercise.typeAnswer': 'Type your answer',
  'exercise.listenAndType': 'Listen and type',
  'exercise.reorderWords': 'Reorder the words',
  'exercise.selectArticle': 'Select the correct article',
  'exercise.conjugateVerb': 'Conjugate the verb',
  
  // Grammar explanations
  'grammar.article.de': '"De" is used for masculine and feminine words in plural and for most feminine words in singular.',
  'grammar.article.het': '"Het" is used for neuter words.',
  'grammar.plural.info': 'Dutch plurals typically end in "-en" or "-s".',
  'grammar.conjugation.present': 'Present tense conjugation',
  
  // Session
  'session.start': 'Start session',
  'session.end': 'End session',
  'session.pause': 'Pause',
  'session.resume': 'Resume',
  'session.complete': 'Session complete!',
  'session.itemsStudied': '{count} items studied',
  'session.accuracy': '{percent}% accuracy',
  
  // Progress
  'progress.title': 'Your progress',
  'progress.itemsLearned': 'Items learned',
  'progress.dueToday': 'Due for review today',
  'progress.streak': 'Current streak',
  'progress.totalTime': 'Total study time',
  
  // Recovery
  'recovery.title': 'Recovery',
  'recovery.forgottenItems': 'Items needing more practice',
  'recovery.inRecovery': 'In recovery',
  
  // Settings
  'settings.title': 'Settings',
  'settings.language': 'Explanation language',
  'settings.theme': 'Theme',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.audioSpeed': 'Audio speed',
  'settings.textSize': 'Text size',
  
  // Audio
  'audio.play': 'Play audio',
  'audio.slowDown': 'Play slower',
  'audio.unavailable': 'Audio unavailable for this language',
  
  // Hints
  'hint.show': 'Show hint',
  'hint.available': 'Hint available',
  
  // Review reasons
  'review.reason.new': 'New item',
  'review.reason.due': 'Scheduled review',
  'review.reason.recovery': 'In recovery',

  // Home / practice modes
  'home.continueLearning': 'Continue learning',
  'home.comingSoon': 'Coming soon',
  'home.practice': 'Practice',
  'home.mode.flashcards': 'Flashcards',
  'home.mode.flashcards.desc': 'Flip & rate yourself',
  'home.mode.write': 'Write',
  'home.mode.write.desc': 'Type the translation',
  'home.mode.match': 'Match',
  'home.mode.match.desc': 'Connect the pairs',
  'home.mode.quiz': 'Quiz',
  'home.mode.quiz.desc': 'Multiple choice',
  'home.yourWords': 'Your words',
  'home.studied': '{count} studied',
  'home.level.learning': 'Learning',
  'home.level.familiar': 'Familiar',
  'home.level.known': 'Known',
  'home.wordsEmpty': "Study some words and they'll show up here as Learning, Familiar, or Known.",
  'home.welcome': 'Welcome to BoostedLearning',
  'home.courseComingSoon': 'The guided course is coming soon. Try the Practice modes above to get started.',

  // Your words detail screen
  'words.title': 'Your words',
  'words.all': 'All',
  'words.empty': 'No practiced words yet. Play a mode and your words will show up here.',

  // Practice (level list)
  'practice.loading': 'Loading decks...',
  'practice.addVocab': 'Add vocabulary from Settings → Vocabulary to start practicing.',
  'practice.builtin': 'Built-in',
  'practice.custom': 'Custom',
  'practice.customCards': '{count} custom',
  'practice.countSummary': '{words} words · {levels} levels',
  'practice.level': 'Level {n}',
  'practice.levelWords': '{count} words',
  'practice.unlockHint': 'Score 70% on the previous level to unlock',
  'practice.quickStudy': 'Quick Study',
};

/**
 * Spanish message catalog
 */
const ES_MESSAGES: MessageCatalog = {
  // Common UI
  'common.continue': 'Continuar',
  'common.back': 'Atrás',
  'common.next': 'Siguiente',
  'common.submit': 'Enviar',
  'common.skip': 'Saltar',
  'common.cancel': 'Cancelar',
  'common.save': 'Guardar',
  'common.delete': 'Eliminar',
  'common.edit': 'Editar',
  'common.close': 'Cerrar',
  'common.loading': 'Cargando...',
  'common.error': 'Error',
  'common.success': 'Éxito',
  'common.retry': 'Reintentar',

  // Exercise feedback
  'feedback.correct': '¡Correcto!',
  'feedback.incorrect': 'Incorrecto',
  'feedback.almost': '¡Casi correcto!',
  'feedback.tryAgain': 'Intentar de nuevo',
  'feedback.showAnswer': 'Ver respuesta',
  'feedback.correctAnswer': 'La respuesta correcta es: {answer}',
  'feedback.almostCorrect': '¡Casi! La respuesta correcta es: {answer}',
  'feedback.youTyped': 'Escribiste:',

  // Session
  'session.start': 'Iniciar sesión',
  'session.end': 'Terminar sesión',
  'session.pause': 'Pausar',
  'session.resume': 'Reanudar',
  'session.complete': '¡Sesión completada!',
  'session.itemsStudied': '{count} elementos estudiados',
  'session.accuracy': '{percent}% de precisión',

  // Progress
  'progress.title': 'Tu progreso',
  'progress.itemsLearned': 'Elementos aprendidos',
  'progress.dueToday': 'Para repasar hoy',
  'progress.streak': 'Racha actual',
  'progress.totalTime': 'Tiempo total de estudio',

  // Recovery
  'recovery.title': 'Recuperación',
  'recovery.forgottenItems': 'Elementos que necesitan más práctica',
  'recovery.inRecovery': 'En recuperación',

  // Settings
  'settings.title': 'Ajustes',
  'settings.language': 'Idioma de la app',
  'settings.theme': 'Tema',
  'settings.theme.light': 'Claro',
  'settings.theme.dark': 'Oscuro',
  'settings.audioSpeed': 'Velocidad del audio',
  'settings.textSize': 'Tamaño del texto',

  // Audio
  'audio.play': 'Reproducir audio',
  'audio.slowDown': 'Reproducir más lento',
  'audio.unavailable': 'Audio no disponible para este idioma',

  // Hints
  'hint.show': 'Mostrar pista',
  'hint.available': 'Pista disponible',

  // Review reasons
  'review.reason.new': 'Elemento nuevo',
  'review.reason.due': 'Repaso programado',
  'review.reason.recovery': 'En recuperación',

  // Home / practice modes
  'home.continueLearning': 'Seguir aprendiendo',
  'home.comingSoon': 'Próximamente',
  'home.practice': 'Practicar',
  'home.mode.flashcards': 'Tarjetas',
  'home.mode.flashcards.desc': 'Voltea y autoevalúate',
  'home.mode.write': 'Escribir',
  'home.mode.write.desc': 'Escribe la traducción',
  'home.mode.match': 'Emparejar',
  'home.mode.match.desc': 'Une las parejas',
  'home.mode.quiz': 'Quiz',
  'home.mode.quiz.desc': 'Opción múltiple',
  'home.yourWords': 'Tus palabras',
  'home.studied': '{count} estudiadas',
  'home.level.learning': 'Aprendiendo',
  'home.level.familiar': 'Familiar',
  'home.level.known': 'Dominada',
  'home.wordsEmpty': 'Estudia algunas palabras y aparecerán aquí como Aprendiendo, Familiar o Dominada.',
  'home.welcome': 'Bienvenido a BoostedLearning',
  'home.courseComingSoon': 'El curso guiado llegará pronto. Prueba los modos de práctica de arriba para empezar.',

  // Your words detail screen
  'words.title': 'Tus palabras',
  'words.all': 'Todas',
  'words.empty': 'Aún no hay palabras practicadas. Juega un modo y tus palabras aparecerán aquí.',

  // Practice (level list)
  'practice.loading': 'Cargando...',
  'practice.addVocab': 'Añade vocabulario en Ajustes → Vocabulario para empezar a practicar.',
  'practice.builtin': 'Incluido',
  'practice.custom': 'Personalizado',
  'practice.customCards': '{count} personalizadas',
  'practice.countSummary': '{words} palabras · {levels} niveles',
  'practice.level': 'Nivel {n}',
  'practice.levelWords': '{count} palabras',
  'practice.unlockHint': 'Consigue 70% en el nivel anterior para desbloquear',
  'practice.quickStudy': 'Estudio rápido',
};

/**
 * All message catalogs indexed by language
 */
const CATALOGS: Record<ExplanationLanguage, MessageCatalog> = {
  pt: PT_MESSAGES,
  fr: FR_MESSAGES,
  en: EN_MESSAGES,
  es: ES_MESSAGES,
};

/**
 * Interpolate parameters into a message string.
 * Parameters are specified as {paramName} in the string.
 */
function interpolate(message: string, params?: Record<string, string | number>): string {
  if (!params) return message;
  
  return message.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Create an i18n service instance.
 * 
 * @param initialLanguage - Initial language (defaults to Portuguese)
 * @returns I18nService implementation
 */
export function createI18nService(initialLanguage: ExplanationLanguage = DEFAULT_EXPLANATION_LANGUAGE): I18nService {
  let currentLanguage = initialLanguage;
  
  return {
    getLanguage(): ExplanationLanguage {
      return currentLanguage;
    },
    
    setLanguage(lang: ExplanationLanguage): void {
      if (lang in CATALOGS) {
        currentLanguage = lang;
      }
    },
    
    t(key: string, params?: Record<string, string | number>): string {
      // Try current language first
      const currentCatalog = CATALOGS[currentLanguage];
      if (key in currentCatalog) {
        return interpolate(currentCatalog[key], params);
      }
      
      // Fall back to Portuguese (R16.3)
      const fallbackCatalog = CATALOGS.pt;
      if (key in fallbackCatalog) {
        return interpolate(fallbackCatalog[key], params);
      }
      
      // If not found even in Portuguese, return the key
      return key;
    },
    
    hasKey(key: string): boolean {
      return key in CATALOGS[currentLanguage];
    },
    
    hasKeyIn(key: string, lang: ExplanationLanguage): boolean {
      return key in CATALOGS[lang];
    },
    
    getAvailableLanguages(): ExplanationLanguage[] {
      return Object.keys(CATALOGS) as ExplanationLanguage[];
    },
  };
}

/**
 * Get the message catalog for a specific language.
 * Useful for testing or direct access.
 */
export function getMessageCatalog(lang: ExplanationLanguage): MessageCatalog {
  return { ...CATALOGS[lang] };
}

/**
 * Get all keys defined in the Portuguese catalog.
 * Useful for testing completeness of other catalogs.
 */
export function getAllKeys(): string[] {
  return Object.keys(PT_MESSAGES);
}
