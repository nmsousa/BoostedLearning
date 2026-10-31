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
  'settings.appLanguage': 'Idioma da app',
  'settings.secAppearance': 'Aparência',
  'settings.secFlashcards': 'Cartões',
  'settings.secAudio': 'Áudio',
  'settings.secLanguage': 'Idioma',
  'settings.secSessions': 'Sessões',
  'settings.secVocabulary': 'Vocabulário',
  'settings.secData': 'Dados',
  'settings.secAbout': 'Sobre',
  'settings.reducedMotion': 'Movimento reduzido',
  'settings.reducedMotionDesc': 'Minimizar animações',
  'settings.reducedDistraction': 'Distração reduzida',
  'settings.reducedDistractionDesc': 'Esconder gamificação não essencial',
  'settings.typingDirection': 'Direção de escrita',
  'settings.typingDirectionDesc': 'Qual idioma escreves durante o estudo',
  'settings.sessionLength': 'Duração da sessão',
  'settings.sessionMinutes': '{n} minutos',
  'settings.dailyGoal': 'Objetivo diário',
  'settings.dailyGoalItems': '{n} itens',
  'settings.reminders': 'Lembretes',
  'settings.remindersDesc': 'Lembretes de prática diária',
  'settings.importDuolingo': 'Importar do Duolingo',
  'settings.importDuolingoDesc': 'Adiciona palavras da tua exportação do Duolingo',
  'settings.addWordManually': 'Adicionar palavra manualmente',
  'settings.addWordManuallyDesc': 'Cria uma única palavra + tradução',
  'settings.addLanguage': 'Adicionar um idioma',
  'settings.addLanguageDesc': 'Importa um idioma completo de uma lista duome.eu',
  'settings.exportCards': 'Exportar os meus cartões',
  'settings.exportCardsDesc': '{n} cartão(ões) personalizado(s) para email/backup',
  'settings.resetSettings': 'Repor definições',
  'settings.version': 'Versão',
  'settings.buildDate': 'Data da compilação',
  'settings.import': 'Importar',
  'settings.importing': 'A importar…',
  'settings.importIntro': 'Importa todas as palavras que aprendeste num idioma específico na tua conta Duolingo. Como o Duolingo não tem exportação, obténs os dados a partir do navegador (num computador).',
  'settings.howToExport': 'Como exportar do Duolingo:',
  'settings.exportStep1': 'No computador, inicia sessão em duolingo.com e escolhe o idioma que queres importar',
  'settings.exportStep2': 'Abre a tua lista de palavras aprendidas: Prática → Palavras (Practice → Words)',
  'settings.exportStep3': 'Abre as Ferramentas de Programador (F12) e vai ao separador Rede (Network)',
  'settings.exportStep4': 'Filtra por "learned-lexemes" e recarrega a página',
  'settings.exportStep5': 'O Duolingo carrega as palavras ~50 de cada vez: faz scroll até ao fim da lista para que todos os pedidos "learned-lexemes" apareçam na Rede',
  'settings.exportStep6': 'Em cada pedido "learned-lexemes", abre a Resposta (Response) e copia o JSON',
  'settings.exportStep7': 'Cola abaixo. Podes colar vários blocos, um a seguir ao outro — nós juntamos tudo',
  'settings.importPagingNote': 'Dica: o Duolingo só mostra ~50 palavras por pedido. Para importares todas, faz scroll por toda a lista e copia cada pedido "learned-lexemes" que aparecer.',
  'settings.importLanguage': 'Idioma destas palavras',
  'settings.deckName': 'Nome do baralho',
  'settings.deckNamePlaceholder': 'ex.: Holandês Duolingo',
  'settings.pasteJson': 'Cola o JSON aqui',
  'settings.addAWord': 'Adicionar uma palavra',
  'settings.manualIntro': 'Adiciona uma palavra e a sua tradução. Isto cria um novo cartão.',
  'settings.wordField': 'Palavra',
  'settings.wordPlaceholder': 'ex.: hond',
  'settings.translationsField': 'Tradução(ões)',
  'settings.translationsPlaceholder': 'ex.: cão, cachorro',
  'settings.translationsHint': 'Separa várias traduções com vírgulas.',
  'settings.manualNotice': 'Os cartões que adicionas são guardados apenas neste dispositivo e perdem-se ao reinstalar ou ao trocar de telefone. Exporta-os para serem incluídos numa versão futura da app.',
  'settings.pickLanguageIntro': 'Escolhe o idioma que queres aprender (cursos a partir de inglês). A lista de palavras é descarregada de duome.eu.',
  'settings.pickLanguageHint': 'Precisa de internet uma vez; as palavras ficam depois guardadas no teu dispositivo. Funciona apenas na app instalada.',
  'settings.languageToLearn': 'Idioma a aprender',
  'settings.chooseLanguage': 'Escolhe um idioma',
  'settings.courseWords': '{name} ({words} palavras)',
  'settings.urlField': 'URL (gerado automaticamente, editável)',

  // Flashcard modes
  'mode.titleFlip': 'Cartões',
  'mode.titleMatch': 'Associar',
  'mode.titleQuiz': 'Quiz',
  'mode.titleWrite': 'Escrever',
  'mode.levelPrefix': 'Nível {n} · ',
  'mode.tapToFlip': 'Toca para virar',
  'mode.tapToFlipBack': 'Toca para virar de volta',
  'mode.langEnglish': 'Inglês',
  'mode.howWellKnew': 'Quão bem a sabias?',
  'mode.howWellKnow': 'Quão bem a sabes?',
  'mode.dontKnow': 'Não sei',
  'mode.soso': 'Mais ou menos',
  'mode.knowIt': 'Sei',
  'mode.levelComplete': 'Nível concluído!',
  'mode.keepPracticing': 'Continua a praticar!',
  'mode.sessionComplete': 'Sessão concluída!',
  'mode.studyComplete': 'Estudo concluído!',
  'mode.quizComplete': 'Quiz concluído!',
  'mode.allMatched': 'Tudo associado!',
  'mode.newBest': '🎉 Novo recorde!',
  'mode.niceWork': 'Bom trabalho. Eis como correu:',
  'mode.done': 'Concluído',
  'mode.continue': 'Continuar',
  'mode.cards': 'Cartões',
  'mode.correct': 'Certas',
  'mode.incorrect': 'Erradas',
  'mode.accuracy': 'Precisão',
  'mode.correctOfTotal': '{correct} / {total} certas',
  // Match specifics
  'mode.comboX': 'x combo',
  'mode.tapWordThenTranslation': 'Toca numa palavra e depois na tradução.',
  'mode.flawless': 'Impecável - sem erros!',
  'mode.oneMistake': '1 erro pelo caminho.',
  'mode.manyMistakes': '{n} erros pelo caminho.',
  'mode.time': 'Tempo',
  'mode.combo': 'Combo',
  'mode.bestCombo': 'Melhor combo',
  'mode.bestTime': 'Melhor tempo',
  'mode.nextStarHint1': 'Termina em menos de {time} sem erros para {stars} estrela.',
  'mode.nextStarHintN': 'Termina em menos de {time} sem erros para {stars} estrelas.',
  // Quiz / Write
  'mode.whichTranslation': 'Qual a tradução correta?',
  'mode.playPronunciation': 'Reproduzir pronúncia',
  'mode.playSlower': 'Reproduzir mais devagar',
  'mode.typeYourAnswer': 'Escreve a tua resposta...',
  'mode.check': 'Verificar',
  'mode.almostTypo': 'Quase! Pequeno erro na tua resposta:',
  'mode.tryAgain': 'Tentar novamente',
  'mode.skip': 'Saltar',
  'mode.acceptedAnswers': 'Respostas aceites',
  'mode.theAnswerIs': 'A resposta é',
  'mode.incorrectLabel': 'Incorreto',
  'mode.correctLabel': 'Correto',
  'mode.alsoAccepted': 'Também: {answers}',
  'mode.typeInTarget': 'Escreve em {lang}',
  'mode.typeInEnglish': 'Escreve a tradução em inglês',
  'mode.showHint': 'Mostrar uma pista',
  'mode.close': 'Fechar',
  'mode.addWord': 'Adicionar uma nova palavra',
  'mode.addWordMsg': 'Adiciona uma palavra e a sua tradução ao idioma atual.',
  'mode.wordLabel': 'Palavra',
  'mode.wordInLang': 'Palavra em {lang}',
  'mode.translationLabel': 'Tradução(ões), separadas por vírgula',
  'mode.add': 'Adicionar',
  'mode.addedToast': 'Palavra adicionada.',
  'mode.duplicateToast': 'Essa palavra já existe.',
  'mode.addFailedToast': 'Não foi possível adicionar a palavra.',
  'mode.hideThisWord': 'Não voltar a mostrar esta palavra',
  'mode.hiddenToast': 'Palavra ocultada da prática.',
  'mode.endStudyHeader': 'Terminar sessão de estudo',
  'mode.endStudyMessage': 'Tens a certeza de que queres terminar esta sessão? O progresso não será guardado.',
  'mode.end': 'Terminar',
  'langName.nl': 'Holandês',
  'langName.dn': 'Holandês',
  'langName.fr': 'Francês',
  'langName.es': 'Espanhol',
  'langName.it': 'Italiano',
  'langName.de': 'Alemão',
  'langName.pt': 'Português',
  'langName.en': 'Inglês',

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
  'home.wordsPracticed': 'palavras praticadas',
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
  'words.search': 'Procurar palavras',
  'words.noResults': 'Nenhuma palavra corresponde à procura.',
  'words.filterLevels': 'Níveis',
  'words.sortBy': 'Ordenar por',
  'words.sort.needsPractice': 'A rever (mais erros)',
  'words.sort.mostSeen': 'Mais vistas',
  'words.sort.leastSeen': 'Menos vistas',
  'words.sort.accuracyHigh': 'Precisão (maior)',
  'words.sort.accuracyLow': 'Precisão (menor)',
  'words.sort.alpha': 'Alfabética (A-Z)',
  'words.priority.boost': 'Mostrar mais vezes',
  'words.priority.normal': 'Frequência normal',
  'words.priority.hide': 'Ocultar da prática',
  'words.hiddenNote': 'Oculta da prática',
  'words.status.enabled': 'Ativas',
  'words.status.hidden': 'Ocultas',

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
  'practice.quickStudy': 'Estudo rápido (sem níveis)',
  'practice.levelsTitle': 'Níveis',
  'practice.resetProgress': 'Repor progresso',
  'practice.deleteDeck': 'Apagar baralho',
  'practice.order.builtinFirst': 'Incluídos primeiro',
  'practice.order.customFirst': 'Personalizados primeiro',
  'practice.menu': 'Opções',
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
  'settings.appLanguage': "Langue de l'app",
  'settings.secAppearance': 'Apparence',
  'settings.secFlashcards': 'Cartes',
  'settings.secAudio': 'Audio',
  'settings.secLanguage': 'Langue',
  'settings.secSessions': 'Sessions',
  'settings.secVocabulary': 'Vocabulaire',
  'settings.secData': 'Données',
  'settings.secAbout': 'À propos',
  'settings.reducedMotion': 'Animations réduites',
  'settings.reducedMotionDesc': 'Minimiser les animations',
  'settings.reducedDistraction': 'Distraction réduite',
  'settings.reducedDistractionDesc': 'Masquer la gamification non essentielle',
  'settings.typingDirection': 'Sens de saisie',
  'settings.typingDirectionDesc': "La langue que tu tapes pendant l'étude",
  'settings.sessionLength': 'Durée de la session',
  'settings.sessionMinutes': '{n} minutes',
  'settings.dailyGoal': 'Objectif quotidien',
  'settings.dailyGoalItems': '{n} éléments',
  'settings.reminders': 'Rappels',
  'settings.remindersDesc': 'Rappels de pratique quotidienne',
  'settings.importDuolingo': 'Importer depuis Duolingo',
  'settings.importDuolingoDesc': 'Ajoute des mots depuis ton export Duolingo',
  'settings.addWordManually': 'Ajouter un mot manuellement',
  'settings.addWordManuallyDesc': 'Crée un seul mot + traduction',
  'settings.addLanguage': 'Ajouter une langue',
  'settings.addLanguageDesc': "Importe une langue complète depuis une liste duome.eu",
  'settings.exportCards': 'Exporter mes cartes',
  'settings.exportCardsDesc': '{n} carte(s) personnalisée(s) vers email/sauvegarde',
  'settings.resetSettings': 'Réinitialiser les paramètres',
  'settings.version': 'Version',
  'settings.buildDate': 'Date de compilation',
  'settings.import': 'Importer',
  'settings.importing': 'Importation…',
  'settings.importIntro': "Importe tous les mots que tu as appris dans une langue précise sur ton compte Duolingo. Comme Duolingo n'a pas d'export, tu récupères les données depuis le navigateur (sur un ordinateur).",
  'settings.howToExport': 'Comment exporter depuis Duolingo :',
  'settings.exportStep1': "Sur un ordinateur, connecte-toi à duolingo.com et choisis la langue à importer",
  'settings.exportStep2': 'Ouvre ta liste de mots appris : Pratique → Mots (Practice → Words)',
  'settings.exportStep3': "Ouvre les outils de développement (F12) et va à l'onglet Réseau (Network)",
  'settings.exportStep4': 'Filtre sur "learned-lexemes" et recharge la page',
  'settings.exportStep5': 'Duolingo charge ~50 mots à la fois : fais défiler jusqu\'au bas de la liste pour que toutes les requêtes "learned-lexemes" apparaissent',
  'settings.exportStep6': 'Pour chaque requête "learned-lexemes", ouvre la Réponse (Response) et copie le JSON',
  'settings.exportStep7': "Colle ci-dessous. Tu peux coller plusieurs blocs à la suite — on fusionne le tout",
  'settings.importPagingNote': 'Astuce : Duolingo n\'affiche que ~50 mots par requête. Pour tout importer, fais défiler toute la liste et copie chaque requête "learned-lexemes" qui apparaît.',
  'settings.importLanguage': 'Langue de ces mots',
  'settings.deckName': 'Nom du paquet',
  'settings.deckNamePlaceholder': 'ex. : Néerlandais Duolingo',
  'settings.pasteJson': 'Colle le JSON ici',
  'settings.addAWord': 'Ajouter un mot',
  'settings.manualIntro': 'Ajoute un mot et sa traduction. Cela crée une nouvelle carte.',
  'settings.wordField': 'Mot',
  'settings.wordPlaceholder': 'ex. : hond',
  'settings.translationsField': 'Traduction(s)',
  'settings.translationsPlaceholder': 'ex. : chien',
  'settings.translationsHint': 'Sépare plusieurs traductions par des virgules.',
  'settings.manualNotice': 'Les cartes que tu ajoutes sont stockées uniquement sur cet appareil et sont perdues à la réinstallation ou au changement de téléphone. Exporte-les pour les inclure dans une future version de l\'app.',
  'settings.pickLanguageIntro': "Choisis la langue que tu veux apprendre (cours depuis l'anglais). La liste de mots est téléchargée depuis duome.eu.",
  'settings.pickLanguageHint': "Nécessite internet une fois ; les mots sont ensuite stockés sur ton appareil. Fonctionne uniquement dans l'app installée.",
  'settings.languageToLearn': 'Langue à apprendre',
  'settings.chooseLanguage': 'Choisis une langue',
  'settings.courseWords': '{name} ({words} mots)',
  'settings.urlField': 'URL (généré automatiquement, modifiable)',

  // Flashcard modes
  'mode.titleFlip': 'Cartes',
  'mode.titleMatch': 'Associer',
  'mode.titleQuiz': 'Quiz',
  'mode.titleWrite': 'Écrire',
  'mode.levelPrefix': 'Niveau {n} · ',
  'mode.tapToFlip': 'Touche pour retourner',
  'mode.tapToFlipBack': 'Touche pour revenir',
  'mode.langEnglish': 'Anglais',
  'mode.howWellKnew': 'Le savais-tu bien ?',
  'mode.howWellKnow': 'Le sais-tu bien ?',
  'mode.dontKnow': 'Je ne sais pas',
  'mode.soso': 'Couci-couça',
  'mode.knowIt': 'Je le sais',
  'mode.levelComplete': 'Niveau terminé !',
  'mode.keepPracticing': 'Continue à pratiquer !',
  'mode.sessionComplete': 'Session terminée !',
  'mode.studyComplete': 'Étude terminée !',
  'mode.quizComplete': 'Quiz terminé !',
  'mode.allMatched': 'Tout associé !',
  'mode.newBest': '🎉 Nouveau record !',
  'mode.niceWork': 'Bien joué. Voici le résultat :',
  'mode.done': 'Terminé',
  'mode.continue': 'Continuer',
  'mode.cards': 'Cartes',
  'mode.correct': 'Correctes',
  'mode.incorrect': 'Incorrectes',
  'mode.accuracy': 'Précision',
  'mode.correctOfTotal': '{correct} / {total} correctes',
  // Match specifics
  'mode.comboX': 'x combo',
  'mode.tapWordThenTranslation': 'Touche un mot, puis sa traduction.',
  'mode.flawless': 'Parfait - aucune erreur !',
  'mode.oneMistake': '1 erreur en chemin.',
  'mode.manyMistakes': '{n} erreurs en chemin.',
  'mode.time': 'Temps',
  'mode.combo': 'Combo',
  'mode.bestCombo': 'Meilleur combo',
  'mode.bestTime': 'Meilleur temps',
  'mode.nextStarHint1': 'Termine en moins de {time} sans erreur pour {stars} étoile.',
  'mode.nextStarHintN': 'Termine en moins de {time} sans erreur pour {stars} étoiles.',
  // Quiz / Write
  'mode.whichTranslation': 'Quelle traduction est correcte ?',
  'mode.playPronunciation': 'Écouter la prononciation',
  'mode.playSlower': 'Écouter plus lentement',
  'mode.typeYourAnswer': 'Tape ta réponse...',
  'mode.check': 'Vérifier',
  'mode.almostTypo': 'Presque ! Petite faute de frappe :',
  'mode.tryAgain': 'Réessayer',
  'mode.skip': 'Passer',
  'mode.acceptedAnswers': 'Réponses acceptées',
  'mode.theAnswerIs': 'La réponse est',
  'mode.incorrectLabel': 'Incorrect',
  'mode.correctLabel': 'Correct',
  'mode.alsoAccepted': 'Aussi : {answers}',
  'mode.typeInTarget': 'Écris en {lang}',
  'mode.typeInEnglish': "Écris la traduction en anglais",
  'mode.showHint': 'Afficher un indice',
  'mode.close': 'Fermer',
  'mode.addWord': 'Ajouter un nouveau mot',
  'mode.addWordMsg': 'Ajoute un mot et sa traduction à la langue actuelle.',
  'mode.wordLabel': 'Mot',
  'mode.wordInLang': 'Mot en {lang}',
  'mode.translationLabel': 'Traduction(s), séparées par des virgules',
  'mode.add': 'Ajouter',
  'mode.addedToast': 'Mot ajouté.',
  'mode.duplicateToast': 'Ce mot existe déjà.',
  'mode.addFailedToast': "Impossible d'ajouter le mot.",
  'mode.hideThisWord': 'Ne plus afficher ce mot',
  'mode.hiddenToast': 'Mot masqué de la pratique.',
  'mode.endStudyHeader': "Terminer la session d'étude",
  'mode.endStudyMessage': 'Veux-tu vraiment terminer cette session ? La progression ne sera pas enregistrée.',
  'mode.end': 'Terminer',
  'langName.nl': 'Néerlandais',
  'langName.dn': 'Néerlandais',
  'langName.fr': 'Français',
  'langName.es': 'Espagnol',
  'langName.it': 'Italien',
  'langName.de': 'Allemand',
  'langName.pt': 'Portugais',
  'langName.en': 'Anglais',

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
  'home.wordsPracticed': 'mots pratiqués',
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
  'words.search': 'Rechercher des mots',
  'words.noResults': 'Aucun mot ne correspond à la recherche.',
  'words.filterLevels': 'Niveaux',
  'words.sortBy': 'Trier par',
  'words.sort.needsPractice': 'À réviser (plus d\'erreurs)',
  'words.sort.mostSeen': 'Les plus vus',
  'words.sort.leastSeen': 'Les moins vus',
  'words.sort.accuracyHigh': 'Précision (haute)',
  'words.sort.accuracyLow': 'Précision (basse)',
  'words.sort.alpha': 'Alphabétique (A-Z)',
  'words.priority.boost': 'Afficher plus souvent',
  'words.priority.normal': 'Fréquence normale',
  'words.priority.hide': 'Masquer de la pratique',
  'words.hiddenNote': 'Masqué de la pratique',
  'words.status.enabled': 'Actifs',
  'words.status.hidden': 'Masqués',

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
  'practice.quickStudy': 'Étude rapide (sans niveaux)',
  'practice.levelsTitle': 'Niveaux',
  'practice.resetProgress': 'Réinitialiser la progression',
  'practice.deleteDeck': 'Supprimer le paquet',
  'practice.order.builtinFirst': "Intégrés d'abord",
  'practice.order.customFirst': "Personnalisés d'abord",
  'practice.menu': 'Options',
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
  'settings.appLanguage': 'App language',
  'settings.secAppearance': 'Appearance',
  'settings.secFlashcards': 'Flashcards',
  'settings.secAudio': 'Audio',
  'settings.secLanguage': 'Language',
  'settings.secSessions': 'Sessions',
  'settings.secVocabulary': 'Vocabulary',
  'settings.secData': 'Data',
  'settings.secAbout': 'About',
  'settings.reducedMotion': 'Reduced Motion',
  'settings.reducedMotionDesc': 'Minimize animations',
  'settings.reducedDistraction': 'Reduced Distraction',
  'settings.reducedDistractionDesc': 'Hide non-essential gamification',
  'settings.typingDirection': 'Typing Direction',
  'settings.typingDirectionDesc': 'Which language you type during study',
  'settings.sessionLength': 'Session Length',
  'settings.sessionMinutes': '{n} minutes',
  'settings.dailyGoal': 'Daily Goal',
  'settings.dailyGoalItems': '{n} items',
  'settings.reminders': 'Reminders',
  'settings.remindersDesc': 'Daily practice reminders',
  'settings.importDuolingo': 'Import from Duolingo',
  'settings.importDuolingoDesc': 'Add words from your Duolingo export',
  'settings.addWordManually': 'Add a word manually',
  'settings.addWordManuallyDesc': 'Create a single word + translation',
  'settings.addLanguage': 'Add a language',
  'settings.addLanguageDesc': 'Import a full language from a duome.eu list',
  'settings.exportCards': 'Export my cards',
  'settings.exportCardsDesc': '{n} custom card(s) to email/backup',
  'settings.resetSettings': 'Reset Settings',
  'settings.version': 'Version',
  'settings.buildDate': 'Build date',
  'settings.import': 'Import',
  'settings.importing': 'Importing…',
  'settings.importIntro': "Import all the words you've learned in a specific language on your Duolingo account. Duolingo has no export, so you grab the data from your browser (on a computer).",
  'settings.howToExport': 'How to export from Duolingo:',
  'settings.exportStep1': 'On a computer, sign in at duolingo.com and pick the language you want to import',
  'settings.exportStep2': 'Open your learned-words list: Practice → Words',
  'settings.exportStep3': 'Open Developer Tools (F12) and go to the Network tab',
  'settings.exportStep4': 'Filter by "learned-lexemes" and reload the page',
  'settings.exportStep5': 'Duolingo loads words ~50 at a time: scroll to the bottom of the list so every "learned-lexemes" request appears in Network',
  'settings.exportStep6': 'For each "learned-lexemes" request, open its Response and copy the JSON',
  'settings.exportStep7': 'Paste below. You can paste several blocks one after another — we merge them all',
  'settings.importPagingNote': 'Tip: Duolingo only shows ~50 words per request. To import them all, scroll through the whole list and copy each "learned-lexemes" request that appears.',
  'settings.importLanguage': 'Language of these words',
  'settings.deckName': 'Deck Name',
  'settings.deckNamePlaceholder': 'e.g., Duolingo Dutch',
  'settings.pasteJson': 'Paste JSON here',
  'settings.addAWord': 'Add a Word',
  'settings.manualIntro': 'Add one word and its translation. This creates a new flashcard.',
  'settings.wordField': 'Word',
  'settings.wordPlaceholder': 'e.g., hond',
  'settings.translationsField': 'Translation(s)',
  'settings.translationsPlaceholder': 'e.g., dog, hound',
  'settings.translationsHint': 'Separate multiple translations with commas.',
  'settings.manualNotice': 'Cards you add are stored only on this device and are lost on reinstall or when switching phones. Export them to be included in a future app version.',
  'settings.pickLanguageIntro': 'Pick the language you want to learn (courses from English). The word list is downloaded from duome.eu.',
  'settings.pickLanguageHint': 'Needs internet once; the words are then stored on your device. Works in the installed app only.',
  'settings.languageToLearn': 'Language to learn',
  'settings.chooseLanguage': 'Choose a language',
  'settings.courseWords': '{name} ({words} words)',
  'settings.urlField': 'URL (auto-built, editable)',

  // Flashcard modes
  'mode.titleFlip': 'Flashcards',
  'mode.titleMatch': 'Match',
  'mode.titleQuiz': 'Quiz',
  'mode.titleWrite': 'Write',
  'mode.levelPrefix': 'Level {n} · ',
  'mode.tapToFlip': 'Tap to flip',
  'mode.tapToFlipBack': 'Tap to flip back',
  'mode.langEnglish': 'English',
  'mode.howWellKnew': 'How well did you know it?',
  'mode.howWellKnow': 'How well do you know it?',
  'mode.dontKnow': "Don't know",
  'mode.soso': 'So-so',
  'mode.knowIt': 'Know it',
  'mode.levelComplete': 'Level complete!',
  'mode.keepPracticing': 'Keep practicing!',
  'mode.sessionComplete': 'Session complete!',
  'mode.studyComplete': 'Study Complete!',
  'mode.quizComplete': 'Quiz complete!',
  'mode.allMatched': 'All matched!',
  'mode.newBest': '🎉 New best score!',
  'mode.niceWork': "Nice work. Here's how it went:",
  'mode.done': 'Done',
  'mode.continue': 'Continue',
  'mode.cards': 'Cards',
  'mode.correct': 'Correct',
  'mode.incorrect': 'Incorrect',
  'mode.accuracy': 'Accuracy',
  'mode.correctOfTotal': '{correct} / {total} correct',
  // Match specifics
  'mode.comboX': 'x combo',
  'mode.tapWordThenTranslation': 'Tap a word, then its translation.',
  'mode.flawless': 'Flawless - no mistakes!',
  'mode.oneMistake': '1 mistake along the way.',
  'mode.manyMistakes': '{n} mistakes along the way.',
  'mode.time': 'Time',
  'mode.combo': 'Combo',
  'mode.bestCombo': 'Best combo',
  'mode.bestTime': 'Best time',
  'mode.nextStarHint1': 'Finish under {time} with no mistakes for {stars} star.',
  'mode.nextStarHintN': 'Finish under {time} with no mistakes for {stars} stars.',
  // Quiz / Write
  'mode.whichTranslation': 'Which translation is correct?',
  'mode.playPronunciation': 'Play pronunciation',
  'mode.playSlower': 'Play slower',
  'mode.typeYourAnswer': 'Type your answer...',
  'mode.check': 'Check',
  'mode.almostTypo': 'Almost! Small typo in your answer:',
  'mode.tryAgain': 'Try Again',
  'mode.skip': 'Skip',
  'mode.acceptedAnswers': 'Accepted answers',
  'mode.theAnswerIs': 'The answer is',
  'mode.incorrectLabel': 'Incorrect',
  'mode.correctLabel': 'Correct',
  'mode.alsoAccepted': 'Also: {answers}',
  'mode.typeInTarget': 'Type in {lang}',
  'mode.typeInEnglish': 'Type the English translation',
  'mode.showHint': 'Show a hint',
  'mode.close': 'Close',
  'mode.addWord': 'Add a new word',
  'mode.addWordMsg': 'Add a word and its translation to the current language.',
  'mode.wordLabel': 'Word',
  'mode.wordInLang': 'Word in {lang}',
  'mode.translationLabel': 'Translation(s), comma-separated',
  'mode.add': 'Add',
  'mode.addedToast': 'Word added.',
  'mode.duplicateToast': 'That word already exists.',
  'mode.addFailedToast': 'Could not add the word.',
  'mode.hideThisWord': "Don't show this word again",
  'mode.hiddenToast': 'Word hidden from practice.',
  'mode.endStudyHeader': 'End Study Session',
  'mode.endStudyMessage': 'Are you sure you want to end this study session? Progress will not be saved.',
  'mode.end': 'End',
  'langName.nl': 'Dutch',
  'langName.dn': 'Dutch',
  'langName.fr': 'French',
  'langName.es': 'Spanish',
  'langName.it': 'Italian',
  'langName.de': 'German',
  'langName.pt': 'Portuguese',
  'langName.en': 'English',

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
  'home.wordsPracticed': 'words practiced',
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
  'words.search': 'Search words',
  'words.noResults': 'No words match your search.',
  'words.filterLevels': 'Levels',
  'words.sortBy': 'Sort by',
  'words.sort.needsPractice': 'Needs practice (most wrong)',
  'words.sort.mostSeen': 'Most seen',
  'words.sort.leastSeen': 'Least seen',
  'words.sort.accuracyHigh': 'Accuracy (high)',
  'words.sort.accuracyLow': 'Accuracy (low)',
  'words.sort.alpha': 'Alphabetical (A-Z)',
  'words.priority.boost': 'Show more often',
  'words.priority.normal': 'Normal frequency',
  'words.priority.hide': 'Hide from practice',
  'words.hiddenNote': 'Hidden from practice',
  'words.status.enabled': 'Enabled',
  'words.status.hidden': 'Hidden',

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
  'practice.quickStudy': 'Quick Study (no levels)',
  'practice.levelsTitle': 'Levels',
  'practice.resetProgress': 'Reset progress',
  'practice.deleteDeck': 'Delete deck',
  'practice.order.builtinFirst': 'Built-in first',
  'practice.order.customFirst': 'Custom first',
  'practice.menu': 'Options',
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
  'settings.appLanguage': 'Idioma de la app',
  'settings.secAppearance': 'Apariencia',
  'settings.secFlashcards': 'Tarjetas',
  'settings.secAudio': 'Audio',
  'settings.secLanguage': 'Idioma',
  'settings.secSessions': 'Sesiones',
  'settings.secVocabulary': 'Vocabulario',
  'settings.secData': 'Datos',
  'settings.secAbout': 'Acerca de',
  'settings.reducedMotion': 'Movimiento reducido',
  'settings.reducedMotionDesc': 'Minimizar animaciones',
  'settings.reducedDistraction': 'Distracción reducida',
  'settings.reducedDistractionDesc': 'Ocultar gamificación no esencial',
  'settings.typingDirection': 'Dirección de escritura',
  'settings.typingDirectionDesc': 'Qué idioma escribes durante el estudio',
  'settings.sessionLength': 'Duración de la sesión',
  'settings.sessionMinutes': '{n} minutos',
  'settings.dailyGoal': 'Objetivo diario',
  'settings.dailyGoalItems': '{n} ítems',
  'settings.reminders': 'Recordatorios',
  'settings.remindersDesc': 'Recordatorios de práctica diaria',
  'settings.importDuolingo': 'Importar desde Duolingo',
  'settings.importDuolingoDesc': 'Añade palabras desde tu exportación de Duolingo',
  'settings.addWordManually': 'Añadir una palabra manualmente',
  'settings.addWordManuallyDesc': 'Crea una sola palabra + traducción',
  'settings.addLanguage': 'Añadir un idioma',
  'settings.addLanguageDesc': 'Importa un idioma completo desde una lista de duome.eu',
  'settings.exportCards': 'Exportar mis tarjetas',
  'settings.exportCardsDesc': '{n} tarjeta(s) personalizada(s) a email/copia',
  'settings.resetSettings': 'Restablecer ajustes',
  'settings.version': 'Versión',
  'settings.buildDate': 'Fecha de compilación',
  'settings.import': 'Importar',
  'settings.importing': 'Importando…',
  'settings.importIntro': 'Importa todas las palabras que aprendiste en un idioma concreto en tu cuenta de Duolingo. Como Duolingo no tiene exportación, obtienes los datos desde el navegador (en un ordenador).',
  'settings.howToExport': 'Cómo exportar desde Duolingo:',
  'settings.exportStep1': 'En un ordenador, inicia sesión en duolingo.com y elige el idioma que quieres importar',
  'settings.exportStep2': 'Abre tu lista de palabras aprendidas: Práctica → Palabras (Practice → Words)',
  'settings.exportStep3': 'Abre las Herramientas de desarrollo (F12) y ve a la pestaña Red (Network)',
  'settings.exportStep4': 'Filtra por "learned-lexemes" y recarga la página',
  'settings.exportStep5': 'Duolingo carga ~50 palabras cada vez: desplázate hasta el final de la lista para que aparezcan todas las peticiones "learned-lexemes"',
  'settings.exportStep6': 'En cada petición "learned-lexemes", abre la Respuesta (Response) y copia el JSON',
  'settings.exportStep7': 'Pega abajo. Puedes pegar varios bloques seguidos — los combinamos todos',
  'settings.importPagingNote': 'Consejo: Duolingo solo muestra ~50 palabras por petición. Para importarlas todas, desplázate por toda la lista y copia cada petición "learned-lexemes" que aparezca.',
  'settings.importLanguage': 'Idioma de estas palabras',
  'settings.deckName': 'Nombre del mazo',
  'settings.deckNamePlaceholder': 'ej.: Neerlandés Duolingo',
  'settings.pasteJson': 'Pega el JSON aquí',
  'settings.addAWord': 'Añadir una palabra',
  'settings.manualIntro': 'Añade una palabra y su traducción. Esto crea una nueva tarjeta.',
  'settings.wordField': 'Palabra',
  'settings.wordPlaceholder': 'ej.: hond',
  'settings.translationsField': 'Traducción(es)',
  'settings.translationsPlaceholder': 'ej.: perro',
  'settings.translationsHint': 'Separa varias traducciones con comas.',
  'settings.manualNotice': 'Las tarjetas que añades se guardan solo en este dispositivo y se pierden al reinstalar o al cambiar de teléfono. Expórtalas para incluirlas en una futura versión de la app.',
  'settings.pickLanguageIntro': 'Elige el idioma que quieres aprender (cursos desde inglés). La lista de palabras se descarga de duome.eu.',
  'settings.pickLanguageHint': 'Necesita internet una vez; las palabras se guardan luego en tu dispositivo. Funciona solo en la app instalada.',
  'settings.languageToLearn': 'Idioma a aprender',
  'settings.chooseLanguage': 'Elige un idioma',
  'settings.courseWords': '{name} ({words} palabras)',
  'settings.urlField': 'URL (generado automáticamente, editable)',

  // Flashcard modes
  'mode.titleFlip': 'Tarjetas',
  'mode.titleMatch': 'Emparejar',
  'mode.titleQuiz': 'Quiz',
  'mode.titleWrite': 'Escribir',
  'mode.levelPrefix': 'Nivel {n} · ',
  'mode.tapToFlip': 'Toca para girar',
  'mode.tapToFlipBack': 'Toca para volver',
  'mode.langEnglish': 'Inglés',
  'mode.howWellKnew': '¿Qué tan bien la sabías?',
  'mode.howWellKnow': '¿Qué tan bien la sabes?',
  'mode.dontKnow': 'No la sé',
  'mode.soso': 'Más o menos',
  'mode.knowIt': 'La sé',
  'mode.levelComplete': '¡Nivel completado!',
  'mode.keepPracticing': '¡Sigue practicando!',
  'mode.sessionComplete': '¡Sesión completada!',
  'mode.studyComplete': '¡Estudio completado!',
  'mode.quizComplete': '¡Quiz completado!',
  'mode.allMatched': '¡Todo emparejado!',
  'mode.newBest': '🎉 ¡Nuevo récord!',
  'mode.niceWork': 'Buen trabajo. Así te fue:',
  'mode.done': 'Hecho',
  'mode.continue': 'Continuar',
  'mode.cards': 'Tarjetas',
  'mode.correct': 'Correctas',
  'mode.incorrect': 'Incorrectas',
  'mode.accuracy': 'Precisión',
  'mode.correctOfTotal': '{correct} / {total} correctas',
  // Match specifics
  'mode.comboX': 'x combo',
  'mode.tapWordThenTranslation': 'Toca una palabra y luego su traducción.',
  'mode.flawless': '¡Impecable, sin errores!',
  'mode.oneMistake': '1 error en el camino.',
  'mode.manyMistakes': '{n} errores en el camino.',
  'mode.time': 'Tiempo',
  'mode.combo': 'Combo',
  'mode.bestCombo': 'Mejor combo',
  'mode.bestTime': 'Mejor tiempo',
  'mode.nextStarHint1': 'Termina en menos de {time} sin errores para {stars} estrella.',
  'mode.nextStarHintN': 'Termina en menos de {time} sin errores para {stars} estrellas.',
  // Quiz / Write
  'mode.whichTranslation': '¿Cuál traducción es correcta?',
  'mode.playPronunciation': 'Reproducir pronunciación',
  'mode.playSlower': 'Reproducir más lento',
  'mode.typeYourAnswer': 'Escribe tu respuesta...',
  'mode.check': 'Comprobar',
  'mode.almostTypo': '¡Casi! Pequeño error en tu respuesta:',
  'mode.tryAgain': 'Intentar de nuevo',
  'mode.skip': 'Saltar',
  'mode.acceptedAnswers': 'Respuestas aceptadas',
  'mode.theAnswerIs': 'La respuesta es',
  'mode.incorrectLabel': 'Incorrecto',
  'mode.correctLabel': 'Correcto',
  'mode.alsoAccepted': 'También: {answers}',
  'mode.typeInTarget': 'Escribe en {lang}',
  'mode.typeInEnglish': 'Escribe la traducción en inglés',
  'mode.showHint': 'Mostrar una pista',
  'mode.close': 'Cerrar',
  'mode.addWord': 'Añadir una palabra nueva',
  'mode.addWordMsg': 'Añade una palabra y su traducción al idioma actual.',
  'mode.wordLabel': 'Palabra',
  'mode.wordInLang': 'Palabra en {lang}',
  'mode.translationLabel': 'Traducción(es), separadas por comas',
  'mode.add': 'Añadir',
  'mode.addedToast': 'Palabra añadida.',
  'mode.duplicateToast': 'Esa palabra ya existe.',
  'mode.addFailedToast': 'No se pudo añadir la palabra.',
  'mode.hideThisWord': 'No volver a mostrar esta palabra',
  'mode.hiddenToast': 'Palabra ocultada de la práctica.',
  'mode.endStudyHeader': 'Terminar sesión de estudio',
  'mode.endStudyMessage': '¿Seguro que quieres terminar esta sesión? El progreso no se guardará.',
  'mode.end': 'Terminar',
  'langName.nl': 'Neerlandés',
  'langName.dn': 'Neerlandés',
  'langName.fr': 'Francés',
  'langName.es': 'Español',
  'langName.it': 'Italiano',
  'langName.de': 'Alemán',
  'langName.pt': 'Portugués',
  'langName.en': 'Inglés',

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
  'home.wordsPracticed': 'palabras practicadas',
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
  'words.search': 'Buscar palabras',
  'words.noResults': 'Ninguna palabra coincide con la búsqueda.',
  'words.filterLevels': 'Niveles',
  'words.sortBy': 'Ordenar por',
  'words.sort.needsPractice': 'A repasar (más errores)',
  'words.sort.mostSeen': 'Más vistas',
  'words.sort.leastSeen': 'Menos vistas',
  'words.sort.accuracyHigh': 'Precisión (alta)',
  'words.sort.accuracyLow': 'Precisión (baja)',
  'words.sort.alpha': 'Alfabético (A-Z)',
  'words.priority.boost': 'Mostrar más a menudo',
  'words.priority.normal': 'Frecuencia normal',
  'words.priority.hide': 'Ocultar de la práctica',
  'words.hiddenNote': 'Oculta de la práctica',
  'words.status.enabled': 'Activas',
  'words.status.hidden': 'Ocultas',

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
  'practice.quickStudy': 'Estudio rápido (sin niveles)',
  'practice.levelsTitle': 'Niveles',
  'practice.resetProgress': 'Restablecer progreso',
  'practice.deleteDeck': 'Eliminar mazo',
  'practice.order.builtinFirst': 'Incluidos primero',
  'practice.order.customFirst': 'Personalizados primero',
  'practice.menu': 'Opciones',
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
