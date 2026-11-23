/**
 * Placement-test instructions in the learner's language.
 *
 * The question bank is authored in English. The French being tested (inside
 * « » quotes, the options and the audio) never changes; only the instruction
 * around it is translated:
 *  - Pre-A1 → A2: the app's language (a beginner shouldn't fail on the instruction);
 *  - B1 and up: French, as in DELF/DALF exams.
 *
 * Keys are the English prompt with every « … » replaced by «…». A prompt
 * without a translation is shown as authored.
 */
import type { PlacementBand } from './placement-types';

type Lang = 'pt' | 'es' | 'fr';

const T: Record<string, Record<Lang, string>> = {
  'You meet someone in the morning. What is the most appropriate greeting?': {
    pt: 'Encontras alguém de manhã. Qual é o cumprimento mais adequado?',
    es: 'Te encuentras con alguien por la mañana. ¿Cuál es el saludo más adecuado?',
    fr: 'Vous rencontrez quelqu’un le matin. Quelle est la salutation la plus appropriée ?',
  },
  'Read the message: «…» What does Paul mean?': {
    pt: 'Lê a mensagem: «…» O que quer dizer o Paul?',
    es: 'Lee el mensaje: «…» ¿Qué quiere decir Paul?',
    fr: 'Lisez le message : «…» Que veut dire Paul ?',
  },
  'Listen and choose the number you hear.': {
    pt: 'Ouve e escolhe o número que ouves.',
    es: 'Escucha y elige el número que oyes.',
    fr: 'Écoutez et choisissez le nombre que vous entendez.',
  },
  'Complete: «…»': { pt: 'Completa: «…»', es: 'Completa: «…»', fr: 'Complétez : «…»' },
  'Complete the sentence: «…»': { pt: 'Completa a frase: «…»', es: 'Completa la frase: «…»', fr: 'Complétez la phrase : «…»' },
  'Read: «…» When does the library close on Saturday?': {
    pt: 'Lê: «…» A que horas fecha a biblioteca ao sábado?',
    es: 'Lee: «…» ¿A qué hora cierra la biblioteca el sábado?',
    fr: 'Lisez : «…» À quelle heure la bibliothèque ferme-t-elle le samedi ?',
  },
  'Listen. What does the customer order?': {
    pt: 'Ouve. O que pede o cliente?', es: 'Escucha. ¿Qué pide el cliente?', fr: 'Écoutez. Que commande le client ?',
  },
  'Choose the correct question: you want to ask where the station is.': {
    pt: 'Escolhe a pergunta correta: queres perguntar onde fica a estação.',
    es: 'Elige la pregunta correcta: quieres preguntar dónde está la estación.',
    fr: 'Choisissez la bonne question : vous voulez demander où est la gare.',
  },
  'Read: «…» What should the reader do?': {
    pt: 'Lê: «…» O que deve fazer o leitor?', es: 'Lee: «…» ¿Qué debe hacer el lector?', fr: 'Lisez : «…» Que doit faire le lecteur ?',
  },
  'Listen to the announcement. Why is bus 5 not stopping at the usual stop?': {
    pt: 'Ouve o anúncio. Porque é que o autocarro 5 não para na paragem habitual?',
    es: 'Escucha el anuncio. ¿Por qué el autobús 5 no para en la parada habitual?',
    fr: 'Écoutez l’annonce. Pourquoi le bus 5 ne s’arrête-t-il pas à l’arrêt habituel ?',
  },
  'Read: «…» What has the team decided?': {
    pt: 'Lê: «…» O que decidiu a equipa?', es: 'Lee: «…» ¿Qué ha decidido el equipo?', fr: 'Lisez : «…» Qu’a décidé l’équipe ?',
  },
  'Listen. Why did the speaker change jobs?': {
    pt: 'Ouve. Porque é que a pessoa mudou de emprego?', es: 'Escucha. ¿Por qué cambió de trabajo la persona?', fr: 'Écoutez. Pourquoi la personne a-t-elle changé de travail ?',
  },
  'Read: «…» What is the author’s main reservation?': {
    pt: 'Lê: «…» Qual é a principal reserva do autor?', es: 'Lee: «…» ¿Cuál es la principal reserva del autor?', fr: 'Lisez : «…» Quelle est la principale réserve de l’auteur ?',
  },
  'Listen. What is the speaker’s position on remote work?': {
    pt: 'Ouve. Qual é a posição da pessoa sobre o teletrabalho?', es: 'Escucha. ¿Cuál es la postura de la persona sobre el teletrabajo?', fr: 'Écoutez. Quelle est la position de la personne sur le télétravail ?',
  },
  'Choose the most appropriate formal reformulation of: «…»': {
    pt: 'Escolhe a reformulação formal mais adequada de: «…»', es: 'Elige la reformulación formal más adecuada de: «…»', fr: 'Choisissez la reformulation soutenue la plus appropriée de : «…»',
  },
  'Read: «…» What is the author questioning?': {
    pt: 'Lê: «…» O que põe o autor em causa?', es: 'Lee: «…» ¿Qué cuestiona el autor?', fr: 'Lisez : «…» Que remet en question l’auteur ?',
  },
  'Listen. What does the speaker imply about the proposed reform?': {
    pt: 'Ouve. O que dá a entender a pessoa sobre a reforma proposta?', es: 'Escucha. ¿Qué da a entender la persona sobre la reforma propuesta?', fr: 'Écoutez. Que laisse entendre la personne sur la réforme proposée ?',
  },
  'Choose the connector that best completes: «…»': {
    pt: 'Escolhe o conector que melhor completa: «…»', es: 'Elige el conector que mejor completa: «…»', fr: 'Choisissez le connecteur qui complète le mieux : «…»',
  },
  'Choose the closest meaning of «…».': {
    pt: 'Escolhe o significado mais próximo de «…».', es: 'Elige el significado más cercano de «…».', fr: 'Choisissez le sens le plus proche de «…».',
  },
  'Read: «…» What is the author’s criticism?': {
    pt: 'Lê: «…» Qual é a crítica do autor?', es: 'Lee: «…» ¿Cuál es la crítica del autor?', fr: 'Lisez : «…» Quelle est la critique de l’auteur ?',
  },
  'Listen. Which interpretation best captures the speaker’s point?': {
    pt: 'Ouve. Que interpretação resume melhor a ideia da pessoa?', es: 'Escucha. ¿Qué interpretación resume mejor la idea de la persona?', fr: 'Écoutez. Quelle interprétation rend le mieux le propos de la personne ?',
  },
  'In the sentence «…», what does feint de indicate?': {
    pt: 'Na frase «…», o que indica «feint de»?', es: 'En la frase «…», ¿qué indica «feint de»?', fr: 'Dans la phrase «…», qu’indique « feint de » ?',
  },
  'What does «…» mean?': { pt: 'O que significa «…»?', es: '¿Qué significa «…»?', fr: 'Que signifie «…» ?' },
  'A door has the sign «…». What does it indicate?': {
    pt: 'Uma porta tem o aviso «…». O que indica?', es: 'Una puerta tiene el cartel «…». ¿Qué indica?', fr: 'Une porte porte l’inscription «…». Qu’est-ce que cela indique ?',
  },
  'Read: «…» What does the sign tell you?': {
    pt: 'Lê: «…» O que te diz o aviso?', es: 'Lee: «…» ¿Qué te dice el cartel?', fr: 'Lisez : «…» Que vous indique le panneau ?',
  },
  'Listen. Which word do you hear?': { pt: 'Ouve. Que palavra ouves?', es: 'Escucha. ¿Qué palabra oyes?', fr: 'Écoutez. Quel mot entendez-vous ?' },
  'How many tickets does the speaker want?': {
    pt: 'Quantos bilhetes quer a pessoa?', es: '¿Cuántos billetes quiere la persona?', fr: 'Combien de billets la personne veut-elle ?',
  },
  'Which expression means «…»?': { pt: 'Que expressão significa «…»?', es: '¿Qué expresión significa «…»?', fr: 'Quelle expression signifie «…» ?' },
  'Which word means «…»?': { pt: 'Que palavra significa «…»?', es: '¿Qué palabra significa «…»?', fr: 'Quel mot signifie «…» ?' },
  'Read: «…» How long is the course?': {
    pt: 'Lê: «…» Quanto tempo dura o curso?', es: 'Lee: «…» ¿Cuánto dura el curso?', fr: 'Lisez : «…» Combien de temps dure le cours ?',
  },
  'Read: «…» What is being offered?': {
    pt: 'Lê: «…» O que está a ser oferecido?', es: 'Lee: «…» ¿Qué se ofrece?', fr: 'Lisez : «…» Qu’est-ce qui est proposé ?',
  },
  'What does the speaker ask you to do?': {
    pt: 'O que te pede a pessoa para fazer?', es: '¿Qué te pide la persona que hagas?', fr: 'Que vous demande de faire la personne ?',
  },
  'At what time is the appointment?': { pt: 'A que horas é a consulta?', es: '¿A qué hora es la cita?', fr: 'À quelle heure est le rendez-vous ?' },
  'Your «…» is your…': { pt: 'O teu «…» é o teu…', es: 'Tu «…» es tu…', fr: 'Votre «…», c’est votre…' },
  'Which phrase means «…»?': { pt: 'Que frase significa «…»?', es: '¿Qué frase significa «…»?', fr: 'Quelle phrase signifie «…» ?' },
  'Read: «…» What is requested?': { pt: 'Lê: «…» O que é pedido?', es: 'Lee: «…» ¿Qué se pide?', fr: 'Lisez : «…» Qu’est-ce qui est demandé ?' },
  'Read: «…» What must you do if you will be away?': {
    pt: 'Lê: «…» O que tens de fazer se fores estar fora?', es: 'Lee: «…» ¿Qué tienes que hacer si vas a estar fuera?', fr: 'Lisez : «…» Que devez-vous faire si vous êtes absent ?',
  },
  'What has changed?': { pt: 'O que mudou?', es: '¿Qué ha cambiado?', fr: 'Qu’est-ce qui a changé ?' },
  'What did the speaker do on Sunday?': {
    pt: 'O que fez a pessoa no domingo?', es: '¿Qué hizo la persona el domingo?', fr: 'Qu’a fait la personne dimanche ?',
  },
  'Choose the most polite request.': {
    pt: 'Escolhe o pedido mais educado.', es: 'Elige la petición más educada.', fr: 'Choisissez la demande la plus polie.',
  },
  'Read: «…» What problem is highlighted?': {
    pt: 'Lê: «…» Que problema é destacado?', es: 'Lee: «…» ¿Qué problema se destaca?', fr: 'Lisez : «…» Quel problème est mis en évidence ?',
  },
  'In «…», what does bien que express?': {
    pt: 'Em «…», o que exprime «bien que»?', es: 'En «…», ¿qué expresa «bien que»?', fr: 'Dans «…», qu’exprime « bien que » ?',
  },
  'Why did the speaker miss the beginning of the meeting?': {
    pt: 'Porque é que a pessoa perdeu o início da reunião?', es: '¿Por qué se perdió la persona el inicio de la reunión?', fr: 'Pourquoi la personne a-t-elle manqué le début de la réunion ?',
  },
  'What is the speaker mainly recommending?': {
    pt: 'O que recomenda sobretudo a pessoa?', es: '¿Qué recomienda sobre todo la persona?', fr: 'Que recommande surtout la personne ?',
  },
  'Choose the natural collocation: «…».': {
    pt: 'Escolhe a combinação de palavras natural: «…».', es: 'Elige la combinación de palabras natural: «…».', fr: 'Choisissez la collocation naturelle : «…».',
  },
  'Read: «…» What is the author arguing?': {
    pt: 'Lê: «…» O que defende o autor?', es: 'Lee: «…» ¿Qué defiende el autor?', fr: 'Lisez : «…» Que soutient l’auteur ?',
  },
  'Read: «…» What is implied?': {
    pt: 'Lê: «…» O que se dá a entender?', es: 'Lee: «…» ¿Qué se da a entender?', fr: 'Lisez : «…» Qu’est-ce qui est sous-entendu ?',
  },
  'What condition does the speaker place on the reform?': {
    pt: 'Que condição põe a pessoa à reforma?', es: '¿Qué condición pone la persona a la reforma?', fr: 'Quelle condition la personne pose-t-elle à la réforme ?',
  },
  'What contrast does the speaker make?': {
    pt: 'Que contraste faz a pessoa?', es: '¿Qué contraste hace la persona?', fr: 'Quel contraste la personne établit-elle ?',
  },
  'Which expression is the most formal equivalent of «…»?': {
    pt: 'Que expressão é o equivalente mais formal de «…»?', es: '¿Qué expresión es el equivalente más formal de «…»?', fr: 'Quelle expression est l’équivalent le plus soutenu de «…» ?',
  },
  'What does «…» mean in «…»?': { pt: 'O que significa «…» em «…»?', es: '¿Qué significa «…» en «…»?', fr: 'Que signifie «…» dans «…» ?' },
  'Choose the most natural formal written continuation: «…»': {
    pt: 'Escolhe a continuação escrita formal mais natural: «…»', es: 'Elige la continuación escrita formal más natural: «…»', fr: 'Choisissez la suite écrite soutenue la plus naturelle : «…»',
  },
  'Read: «…» What is being criticised?': {
    pt: 'Lê: «…» O que está a ser criticado?', es: 'Lee: «…» ¿Qué se critica?', fr: 'Lisez : «…» Qu’est-ce qui est critiqué ?',
  },
  'In the passage above, «…» means…': { pt: 'No texto acima, «…» significa…', es: 'En el texto anterior, «…» significa…', fr: 'Dans le passage ci-dessus, «…» signifie…' },
  'What is the speaker’s main reservation?': {
    pt: 'Qual é a principal reserva da pessoa?', es: '¿Cuál es la principal reserva de la persona?', fr: 'Quelle est la principale réserve de la personne ?',
  },
  'How does the speaker relate innovation to accountability?': {
    pt: 'Como relaciona a pessoa a inovação com a responsabilidade?', es: '¿Cómo relaciona la persona la innovación con la responsabilidad?', fr: 'Comment la personne relie-t-elle l’innovation et la responsabilité ?',
  },
  'Choose the sentence that correctly uses «…».': {
    pt: 'Escolhe a frase que usa «…» corretamente.', es: 'Elige la frase que usa «…» correctamente.', fr: 'Choisissez la phrase qui emploie correctement «…».',
  },
  'Read: «…» What is the implied criticism?': {
    pt: 'Lê: «…» Qual é a crítica implícita?', es: 'Lee: «…» ¿Cuál es la crítica implícita?', fr: 'Lisez : «…» Quelle est la critique implicite ?',
  },
  'What is the speaker suggesting?': { pt: 'O que sugere a pessoa?', es: '¿Qué sugiere la persona?', fr: 'Que suggère la personne ?' },
  'What is the speaker’s attitude toward the claim being discussed?': {
    pt: 'Qual é a atitude da pessoa em relação à afirmação discutida?', es: '¿Cuál es la actitud de la persona ante la afirmación que se discute?', fr: 'Quelle est l’attitude de la personne envers l’affirmation discutée ?',
  },
  '«…» is a conclusion that is…': { pt: '«…» é uma conclusão…', es: '«…» es una conclusión…', fr: '«…» est une conclusion…' },
};

const QUOTE = /«[^»]*»/g;
const FRENCH_FROM: readonly PlacementBand[] = ['b1', 'b2', 'c1', 'c2'];

/** The language a question's instruction is shown in. */
export function instructionLang(band: PlacementBand, appLang: string): string {
  return FRENCH_FROM.includes(band) ? 'fr' : appLang;
}

/** The prompt in `lang` ('en' or unknown = as authored), keeping the quoted French. */
export function localizePrompt(prompt: string, lang: string): string {
  if (lang !== 'pt' && lang !== 'es' && lang !== 'fr') return prompt;
  const quotes = prompt.match(QUOTE) ?? [];
  const key = prompt.replace(QUOTE, '«…»').trim();
  const tr = T[key]?.[lang];
  if (!tr) return prompt;
  let i = 0;
  return tr.replace(/«…»/g, () => quotes[i++] ?? '«…»');
}

/** Every instruction template (for the coverage test). */
export const PROMPT_TEMPLATES = Object.keys(T);
