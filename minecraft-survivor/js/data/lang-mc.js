/* ============ lang-mc.js — Minecraft Survivor overrides for lang-en.js ============
 * lang-en.js is PokéSurvivor's Spanish -> English dictionary. Most game text is
 * now written in English at the source, but some engine files still emit
 * Spanish. Each entry here replaces the lang-en.js entry with the same Spanish
 * key, so what reaches the screen uses the Minecraft vocabulary (CONTENT.md).
 * Loaded right after lang-en.js. See js/core/i18n.js.
 */
G.I18n.add({
  // ---------------- elements (Spanish type names, if any engine text still uses them) ----------------
  'Acero': 'Iron', 'Agua': 'Aquatic', 'Bicho': 'Arthropod', 'Dragón': 'Dragon', 'Eléctrico': 'Redstone', 'Fantasma': 'Undead',
  'Fuego': 'Fire', 'Hada': 'Magic', 'Hielo': 'Frost', 'Lucha': 'Brute', 'Planta': 'Nature', 'Psíquico': 'Ender',
  'Roca': 'Stone', 'Siniestro': 'Shadow', 'Tierra': 'Earth', 'Veneno': 'Poison', 'Volador': 'Wind', 'Teselia': 'Overworld',

  // ---------------- level-up stats and Smithing conditions (= G.LevelUp.STATS titles) ----------------
  'Vigor': 'Health Boost', 'Potencia': 'Strength', 'Carrera': 'Speed', 'Reflejos': 'Haste', 'Coraza': 'Resistance',
  'Síntesis': 'Regeneration', 'Imán': 'Magnetism', 'Aprendizaje': 'Wisdom', 'Baya Zidra': 'Golden Apple',
  'EVOLUCIÓN': 'SMITHING', 'Evoluciona': 'Smithing for', 'Mejora': 'Upgrade', 'Nv.': 'Lv.',
  '+10% de daño con todos los movimientos.': '+10% damage with every skill.', '-8% de recarga en todos los movimientos.': '-8% cooldown on every skill.',
  'Recupera el 45% de tu vida ahora mismo.': 'Restores 45% of your health right now.',

  // ---------------- held items ----------------
  'Restos': 'Potion of Regeneration', 'Cinta Elección': 'Mace', 'Garra Rápida': 'Redstone Repeater', 'Banda Focus': 'Totem of Undying',
  'Cascabel Concha': 'Glistering Melon', 'Moneda Amuleto': 'Rabbit\'s Foot', 'Huevo Suerte': 'Bottle o\' Enchanting', 'Vidasfera': 'Ominous Bottle',
  'Pañuelo Elección': 'Potion of Swiftness', 'Casco Dentado': 'Turtle Shell', 'Chaleco Asalto': 'Netherite Chestplate',
  '+40% de daño, pero no puedes cambiar de movimiento.': '+40% damage, but you can\'t switch skills.',
  '-20% de recarga en todos tus movimientos.': '-20% cooldown on all your skills.', '+50% de Pokémonedas al acabar la run.': '+50% emeralds at the end of the run.',
  '¡Banda Focus!': 'Totem of Undying!',

  // ---------------- permanent upgrades ----------------
  'Vitalidad': 'Health Boost', 'Fuerza': 'Sharpness', 'Zancada': 'Swift Sneak', 'Fortuna': 'Fortune', 'Sabiduría': 'Wisdom', 'Repertorio': 'Hotbar',
  '+8% Pokémonedas': '+8% emeralds', 'Empiezas con 2 movimientos': 'Start with 2 skills', 'Golpe Crítico': 'Critical Hit',
  'Cambio de cartas': 'Reroll', 'Veto': 'Blacklist', 'Bloquea 1 movimiento: no te sale en las cartas': 'Block 1 skill from the level-up cards',
  'Cada Pokémon tiene sus propias mejoras: sólo cuentan cuando juegas con él.': 'Each mob has its own upgrades: they only count when you play as it.',
  'Atajos de movimientos': 'Hotbar shortcuts',

  // ---------------- weather ----------------
  'Sol abrasador': 'Heatwave', 'Tormenta de arena': 'Sandstorm', 'Nevada': 'Blizzard', 'Niebla': 'Eerie Fog',
  'el Agua se potencia y el Fuego se debilita': 'Aquatic and Redstone are boosted, Fire is weakened',
  'el Fuego se potencia y el Agua se debilita': 'Fire is boosted, Aquatic is weakened',
  'Roca, Tierra y Acero se potencian; el resto sufre': 'Stone, Earth and Iron are boosted; the rest suffer',
  'el Hielo se potencia; el resto sufre y va más lento': 'Frost is boosted; the rest suffer and slow down',
  'Fantasma, Hada y Psíquico se potencian': 'Undead, Magic and Ender are boosted',
  'Furia': 'Strength', 'Prisa': 'Haste', '¡Pegajoso!': 'Cobweb!', 'El manantial se ha secado (se recarga solo)': 'The cauldron is empty (it refills on its own)',

  // ---------------- run notices ----------------
  '¡{x} salvaje apareció!': 'A wild {x} appeared!', '¡{x} shiny salvaje apareció!': 'An Enchanted {x} appeared!',
  '¡Un {x} shiny anda cerca!': 'An Enchanted {x} is nearby!', '¡Marea de Pokémon!': 'Mob swarm incoming!',
  '¡Has conseguido a {x} shiny!': 'Enchanted! You got an Enchanted {x}!', '¡Otro {x} shiny! (+300 monedas)': 'Another Enchanted {x}! (+300 emeralds)',
  '¡{x} te esperaba en la grieta!': 'The {x} guards the Trial Chamber!', '¡{x} shiny te esperaba en la grieta!': 'An Enchanted {x} guards the Trial Chamber!',
  '¡Has vencido a {x}! Recoge el premio…': 'You defeated the {x}! Grab your reward…',
  '¡Vínculo!': 'Combo!', 'Vínculo': 'Combo',
  'Los movimientos unidos se lanzan a la vez y ocupan un solo hueco': 'Linked skills fire together and take one slot',
  'Elige qué movimiento se une a {x}': 'Choose which skill joins {x}', '¿Con cuál unes {x}?': 'Which skill do you link {x} with?',
  'Elige el primer movimiento que vas a unir': 'Choose the first skill to link',
  'Se lanzará a la vez que {x}. Queda un hueco libre.': 'It will fire together with {x}. A slot is freed.',
  'Se lanzará a la vez que {x}.': 'It will fire together with {x}.',
  '¡Vínculo! {x} movimientos a la vez': 'Combo! {x} skills at once', 'Guardas el vínculo: aprende otro movimiento para usarlo': 'Combo saved: learn another skill to use it',
  '¡Se ha abierto una grieta misteriosa!': 'A Trial Chamber has opened!', 'Has entrado en la grieta…': 'You stepped into the Trial Chamber…',
  'La grieta os ha expulsado…': 'The Trial Chamber threw you out…',
  '+1 ticket': '+1 Trial Key', '¡Ticket ×10!': 'Ominous Key!',
  'Grieta · {x} m · {x} s': 'Trial Chamber · {x} m · {x} s', 'Grieta · {x}': 'Trial Chamber · {x}', 'Grieta ·': 'Trial Chamber ·', 'GRIETA ·': 'TRIAL CHAMBER ·',
  'GRIETA · {x} m · {x} s': 'TRIAL CHAMBER · {x} m · {x} s', 'GRIETA · {x} s': 'TRIAL CHAMBER · {x} s',
  '¡SE HA ABIERTO UNA GRIETA!': 'A NETHER PORTAL HAS OPENED!', 'Sigue la flecha morada: dentro te espera un legendario': 'Follow the purple arrow: a boss mob waits inside',
  'MONEDAS': 'EMERALDS', 'DERROTADOS ·': 'DEFEATED ·', '{x} · {x} DERROTADOS · {x} MONEDAS': '{x} · {x} DEFEATED · {x} EMERALDS',
  'Arrastra el dedo para moverte · toca un ataque para cambiarlo': 'Drag your finger to move · tap a skill to switch',
  'WASD moverse · 1-4 / Q / E o clic en un ataque para cambiarlo · Esc pausa': 'WASD move · 1-4 / Q / E or click a skill to switch · Esc pause',
  'movimiento ·': 'skill ·', '¡{x} se ha enfurecido!': 'The {x} is enraged!', '¡{x} se ha escapado!': 'The {x} got away!',

  // ---------------- events ----------------
  '¡Horda de tipo {x}!': 'A siege of {x} mobs!', '¡Hora dorada! Doble de experiencia': 'Emerald Rush! Double experience',
  '¡Un {x} se ha perdido! Búscalo y llévalo a la marca': 'Lost Pet! A {x} is lost: find it and lead it home',
  '¡{x} te sigue! Llévalo a la marca verde': 'The {x} is following you! Lead it to the green marker',
  '¡{x} te da las gracias! (+150 monedas, ya lo tenías)': '{x} thanks you! (+150 emeralds, you already had it)',
  '¡Un {x} con un ticket ×10! ¡Atrápalo antes de que huya!': 'A {x} is carrying an Ominous Key! Catch it before it runs away!',
  '¡Un {x} cargado de monedas! ¡Atrápalo antes de que huya!': 'A {x} stole a pile of emeralds! Catch it before it runs away!',
  'HORA DORADA · {x} s': 'EMERALD RUSH · {x} s', 'HORDA {x} · {x} s': '{x} MOB SIEGE · {x} s', 'Marca · {x} m': 'Home · {x} m',

  // ---------------- pause and end ----------------
  'Pokémonedas ganadas': 'Emeralds earned', 'Movimientos': 'Skills', '{x} Shinies conseguidos': '{x} Enchanted mobs collected',
  'Tickets del gacha': 'Spawner keys',

  // ---------------- start, menu and Mobdex ----------------
  'Mundo Misterioso': 'Survive the Night', 'Sobrevive a las hordas con tu compañero Pokémon · gratis, en PC y móvil': 'Survive the night with your partner mob',
  'Sobrevive a las hordas con tu compañero Pokémon': 'Survive the night with your partner mob',
  'Juego de supervivencia con Pokémon, gratis en el navegador y en el móvil.': 'Survive the night with your partner mob.',
  'Entrenador': 'Player', 'Selecciona un Pokémon': 'Pick a mob', 'Los iniciales de todas las regiones, y dos amigos más.': 'Pick the mob that will survive the night with you.',
  'Entra en la mazmorra': 'Survive the night', 'Pokémon': 'Mob', 'Tu colección': 'Your collection', 'Gacha': 'Spawner',
  '9 regiones · Pokémon y shinies': '7 realms · mobs and Enchanted mobs',
  'Proyecto de fan sin ánimo de lucro · Sprites: SpriteCollab (CC BY-NC 4.0) · Pokémon © Nintendo/Creatures/GAME FREAK ·': 'Unofficial fan game. Not affiliated with Mojang or Microsoft. Minecraft assets © Mojang. ·',
  'Legendaria': 'Legendary', '(shiny)': '(Enchanted)', 'o derrotándolo cuando salga shiny.': 'or defeat it when it shows up Enchanted.',
  'Consíguelo en el banner de': 'Get it at the Spawner, realm', '{x} shiny es ahora tu compañero': 'Enchanted {x} is now your partner',
  '· {x} shiny': '· {x} Enchanted', 'Movimientos que puede aprender': 'Skills it can learn', 'Pokédex': 'Mobdex',
  'Misterioso': 'Spawner', 'Los {x} Pokémon de la generación {x}. ¡Los legendarios esperan!': 'The {x} mobs of realm {x}. Legendary mobs await!',
  'Gen {x}': 'Realm {x}', 'Tiradas sin legendaria en {x}: {x} / {x}': 'Spawns without a Legendary in {x}: {x} / {x}',
  '· A las {x} tiradas sin Legendaria en un banner, la siguiente lo es.': '· After {x} spawns without a Legendary in a realm, the next one is.',
  '· Los repetidos dan Pokémonedas. Los shiny no se repiten.': '· Duplicates give emeralds. Enchanted mobs never repeat.',
  '· Los tickets se consiguen jugando: algunos Pokémon los sueltan al caer, y los jefes y los legendarios de las grietas, a veces, tickets ×10.':
    '· Keys are earned by playing: some mobs drop a Trial Key, and bosses and Trial Chamber elites sometimes drop an Ominous Key.',
  'Tirar ×1 ·': 'Spawn ×1 ·', 'Tirar ×10 ·': 'Spawn ×10 ·', 'tickets ×10': 'Ominous Keys', 'tickets y {x}': 'Trial Keys and {x}', 'tickets y': 'Trial Keys and',
  'No tienes tickets suficientes: consíguelos jugando': 'Not enough keys: earn them by playing', '¡SHINY NUEVO!': 'NEW ENCHANTED!',
  '· {x} {x} shiny': '· {x} {x} Enchanted', '{x} Shiny': '{x} Enchanted', '¡¿SHINY?!': 'ENCHANTED?!', '¡¿LEGENDARIO?!': 'LEGENDARY?!', 'SHINY ·': 'ENCHANTED ·',
  'TIRADA': 'SPAWN', 'TIRADA ×10': 'SPAWN ×10',

  // ---------------- missions, achievements and profile ----------------
  'Legendarios vencidos {x} / {x}': 'Boss mobs defeated {x} / {x}', 'Tus 3 Pokémon favoritos': 'Your 3 favourite mobs', 'Legendarios': 'Boss mobs',
  'Derrota a {x} Pokémon': 'Defeat {x} mobs', 'Derrota a {x} Pokémon de tipo {x}': 'Defeat {x} {x} mobs',
  'Aguanta {x} minutos con un Pokémon de tipo {x}': 'Survive {x} minutes as a {x} mob', 'Recoge {x} monedas en tus runs': 'Collect {x} emeralds in your runs',
  'Gana una pelea en una grieta': 'Win a Trial Chamber battle', 'Gana {x} peleas en grietas': 'Win {x} Trial Chamber battles',
  'Evoluciona un movimiento': 'Use a Smithing card', 'Evoluciona {x} movimientos': 'Use {x} Smithing cards', 'Grietas': 'Trial Chambers',
  'Vence a {x}': 'Defeat the {x}', 'Derrota a {x} en una grieta.': 'Defeat the {x} in a Trial Chamber.',

  // ---------------- online features (unreachable offline) ----------------
  'Filtrar por Pokémon (histórico)': 'Filter by mob (all-time)', 'No hay ningún Pokémon con ese nombre': 'There\'s no mob with that name',
  'Es el nombre que verán tus amigos y el que sale en el ranking. Tu nombre y tu correo de Google no se enseñan a nadie.': 'It\'s the name your friends will see and the one on the leaderboard.',
  'es público para otros jugadores. Guardamos tu lista de amigos, si estás en línea y tus mejores tiempos (con tu apodo y tu Pokémon).':
    'is public to other players.',
  'Hay una versión nueva del juego: actualizando en {x} s…': 'A new version of the game is out: updating in {x} s…',

  // ---------------- settings, legal, boot ----------------
  'elegir ataque': 'choose skill', 'ataque anterior / siguiente': 'previous / next skill',
  'Pon el dedo en cualquier parte y arrastra para moverte: el joystick aparece donde tocas. Toca un ataque de abajo para cambiarlo y el botón de arriba a la derecha para pausar. Se juega en horizontal.':
    'Put your finger anywhere and drag to move: the joystick appears where you touch. Tap a skill at the bottom to switch to it and the top-right button to pause. Play in landscape.',
  'PokéSurvivor se juega en horizontal.': 'Minecraft Survivor is played in landscape.',
  'PokéSurvivor necesita JavaScript para funcionar. Actívalo para jugar.': 'Minecraft Survivor needs JavaScript to work. Please enable it to play.',
  'Datos de los Pokémon:': 'Mob data:', 'Elegir de compañero{x}': 'Choose as partner{x}',

  // ---------------- Herobrine Awakens (the last floor) ----------------
  'Ruinas del Juicio': 'The Void', 'LA SENTENCIA': 'HEROBRINE', 'DE ARCEUS': 'HAS AWAKENED', 'El tiempo se ha agotado…': 'Your time is up…',
  '¡ARCEUS HA DESCENDIDO!': 'HEROBRINE AWAKENS', 'Es invencible: huye y aguanta todo lo que puedas': 'He cannot be beaten: run and survive as long as you can',
  '¡Huye de Arceus! Es invencible': 'Run from Herobrine! He cannot be beaten', '¡{x} acude a la Sentencia!': 'The {x} joins the hunt!',
  'SENTENCIA · {x} · JEFES {x}': 'HEROBRINE AWAKENS · {x} · BOSSES {x}', 'Ante Arceus': 'Against Herobrine',
  '{x} · {x} legendarios': '{x} · {x} boss mobs', '{x} · {x} legendario': '{x} · {x} boss mob',
  'La Sentencia': 'Herobrine Awakens', 'Llega a la Sentencia de Arceus (minuto 30).': 'Climb to Herobrine\'s World, the last floor.',
  'Ante el Creador': 'Staring Contest', 'Aguanta 1 minuto ante Arceus.': 'Survive 1 minute against Herobrine.',
  'Desafío divino': 'Boss Rush', 'Derrota a 3 legendarios ante Arceus en una partida.': 'Defeat 3 boss mobs while Herobrine hunts you, in a single run.',
  'Juzgado': 'Haunted', 'Elegido de Arceus': 'Herobrine\'s Rival'
});
