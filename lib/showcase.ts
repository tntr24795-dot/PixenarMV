export type ShowcaseTemplate = {
  slug: string;
  title: string;
  category: string;
  description: string;
  prompt: string;
  style: string;
  aspectRatio: "16:9" | "9:16";
  durationSeconds: number;
  modelId: string;
  videoSrc?: string;
};

export const showcaseTemplates: ShowcaseTemplate[] = [
  {
    slug: "rainy-laundromat-love",
    title: "Rainy Laundromat Love",
    category: "Short Drama",
    description: "A restrained romantic encounter in a quiet laundromat on a rainy night.",
    prompt: "A cinematic short drama set in a quiet laundromat on a rainy night. A young man waits beside a washing machine while cool neon reflections shimmer on the wet floor. A young woman enters carrying a small bag and pauses at the door. Build a subtle romantic story with natural acting, intimate close-ups, slow camera push-ins, realistic skin tones, restrained emotion, consistent wardrobe and character identity, no text on screen.",
    style: "cinematic-realism",
    aspectRatio: "16:9",
    durationSeconds: 32,
    modelId: "wan-3-0"
  },
  {
    slug: "last-message-midnight",
    title: "The Last Message at Midnight",
    category: "Short Drama",
    description: "A melancholic apartment drama built around one unread message.",
    prompt: "A moody cinematic short drama inside a dim apartment at midnight. A young woman sits on the floor beside her bed, staring at an unread message on her phone while rain falls outside the window. Build the story through silence, hesitation, memory and a final decision. Use soft practical lighting, restrained acting, shallow depth of field and consistent character identity.",
    style: "cinematic-realism",
    aspectRatio: "16:9",
    durationSeconds: 32,
    modelId: "wan-3-0"
  },
  {
    slug: "first-date-cafe",
    title: "First Date at a Quiet Cafe",
    category: "Romance",
    description: "Natural first-date tension in a warm evening cafe.",
    prompt: "A warm cinematic short film about two young adults meeting for their first date in a quiet cafe. They are both nervous but trying not to show it. Build small conversational beats, eye contact, awkward pauses and a gentle emotional payoff. Soft evening light, natural acting, elegant camera movement, consistent faces and wardrobe.",
    style: "cinematic-realism",
    aspectRatio: "16:9",
    durationSeconds: 32,
    modelId: "wan-3-0"
  },
  {
    slug: "train-station-goodbye",
    title: "Goodbye at the Train Station",
    category: "Drama",
    description: "A bittersweet farewell told through glances and movement.",
    prompt: "A cinematic emotional farewell at a modern train station just before departure. Two people who still care about each other struggle to say goodbye. Use wide establishing shots, close-ups of hands and eyes, realistic crowd movement, restrained dialogue, cool morning light and continuity across every scene.",
    style: "cinematic-realism",
    aspectRatio: "16:9",
    durationSeconds: 40,
    modelId: "wan-3-0"
  },
  {
    slug: "silent-reunion-rain",
    title: "Silent Reunion in the Rain",
    category: "Drama",
    description: "Two people meet again after years apart.",
    prompt: "A cinematic reunion in light rain outside a small neighborhood store at night. Two former lovers unexpectedly see each other after years apart. Build the scene with silence, surprise, restrained emotion and a short honest conversation. Cool white lighting, wet pavement reflections, subtle handheld camera and consistent character appearance.",
    style: "cinematic-realism",
    aspectRatio: "16:9",
    durationSeconds: 32,
    modelId: "wan-3-0"
  },
  {
    slug: "luxury-beach-escape",
    title: "Luxury Beach Escape",
    category: "Travel",
    description: "Premium resort storytelling at sunrise.",
    prompt: "A premium cinematic travel film at a luxury tropical beach resort during sunrise. Show white sand, clear water, elegant architecture, a traveler walking barefoot by the shore, breakfast overlooking the ocean and a final aerial reveal. Smooth camera movement, aspirational mood, natural luxury, no text.",
    style: "cinematic-realism",
    aspectRatio: "16:9",
    durationSeconds: 30,
    modelId: "wan-3-0"
  },
  {
    slug: "tokyo-night-walk",
    title: "Tokyo Night Walk",
    category: "Travel",
    description: "Neon streets, rain and atmospheric city movement.",
    prompt: "A cinematic night walk through a dense futuristic city district in Tokyo after rain. Follow one traveler through glowing signs, crosswalks, narrow alleys and late-night food stalls. Use reflective pavement, realistic crowds, slow tracking shots, ambient city energy and a consistent lead character.",
    style: "cinematic-realism",
    aspectRatio: "16:9",
    durationSeconds: 30,
    modelId: "wan-3-0"
  },
  {
    slug: "mountain-cabin-morning",
    title: "Mountain Cabin Morning",
    category: "Lifestyle",
    description: "A calm, cozy morning in the mountains.",
    prompt: "A peaceful cinematic morning at a wooden cabin in the mountains. Warm sunlight enters through the window, steam rises from a mug, a person opens the door to pine trees and mist, then walks outside into the quiet landscape. Cozy, natural, premium lifestyle aesthetic with gentle camera motion.",
    style: "cinematic-realism",
    aspectRatio: "16:9",
    durationSeconds: 24,
    modelId: "wan-3-0"
  },
  {
    slug: "desert-road-adventure",
    title: "Desert Road Adventure",
    category: "Travel",
    description: "A cinematic road trip through an open desert.",
    prompt: "A cinematic road-trip film through a vast desert at golden hour. A modern SUV follows an empty road between dramatic rock formations. Include interior driving shots, roadside stops, wind-blown clothing and a wide sunset finish. Premium travel commercial look, realistic motion and consistent vehicle details.",
    style: "cinematic-realism",
    aspectRatio: "16:9",
    durationSeconds: 30,
    modelId: "wan-3-0"
  },
  {
    slug: "old-town-cinematic-tour",
    title: "Old Town Cinematic Tour",
    category: "Travel",
    description: "Elegant European streets captured like a destination film.",
    prompt: "A refined cinematic travel story through a historic European old town in the early morning. Follow a traveler through stone streets, a small bakery, a quiet plaza and a rooftop view. Soft natural light, elegant pacing, realistic architecture and smooth camera transitions.",
    style: "cinematic-realism",
    aspectRatio: "16:9",
    durationSeconds: 30,
    modelId: "wan-3-0"
  },
  {
    slug: "luxury-perfume-ad",
    title: "Luxury Perfume Ad",
    category: "Commercial",
    description: "Dark glossy product cinematography with macro detail.",
    prompt: "A premium perfume commercial in a dark studio. Reveal an elegant glass bottle on a glossy black surface with water droplets, controlled reflections and drifting mist. Use macro details, slow rotating hero shots, dramatic highlights, rich shadows and a refined luxury advertising aesthetic.",
    style: "cinematic-realism",
    aspectRatio: "16:9",
    durationSeconds: 16,
    modelId: "runway-4-5"
  },
  {
    slug: "smartphone-promo",
    title: "Modern Smartphone Promo",
    category: "Commercial",
    description: "Clean high-tech product reveal and feature storytelling.",
    prompt: "A modern cinematic smartphone commercial. Reveal a sleek phone in a minimal dark studio, then show close-up details of the camera, screen, metal frame and interface through smooth motion. Add a brief lifestyle shot in natural daylight. Premium technology advertising, crisp reflections and precise product consistency.",
    style: "cinematic-realism",
    aspectRatio: "16:9",
    durationSeconds: 20,
    modelId: "runway-4-5"
  },
  {
    slug: "coffee-brand-ad",
    title: "Coffee Brand Cinematic Ad",
    category: "Commercial",
    description: "Warm craft-focused beverage advertising.",
    prompt: "A cinematic coffee commercial focused on craft and atmosphere. Show roasted beans, grinding, espresso extraction, milk texture and a finished cup by a window in the morning. Macro photography, warm natural light, gentle steam, tactile sound-inspired visuals and premium cafe branding without visible text.",
    style: "cinematic-realism",
    aspectRatio: "16:9",
    durationSeconds: 20,
    modelId: "wan-3-0"
  },
  {
    slug: "sports-car-reveal",
    title: "Sports Car Reveal",
    category: "Automotive",
    description: "A dramatic studio reveal for a premium performance car.",
    prompt: "A sleek cinematic sports car reveal in a dark studio. A premium coupe emerges from shadow as narrow beams of light travel across its bodywork. Include low-angle tracking shots, wheel and brake details, cockpit close-ups and a final full-car hero reveal. Realistic reflections, controlled motion, no logos or text.",
    style: "cinematic-realism",
    aspectRatio: "16:9",
    durationSeconds: 24,
    modelId: "runway-4-5"
  },
  {
    slug: "skincare-commercial",
    title: "Skincare Product Commercial",
    category: "Commercial",
    description: "Soft clean beauty cinematography for a premium skincare product.",
    prompt: "A clean premium skincare commercial with a glass serum bottle, soft water reflections, translucent fabric and close-up skin texture. Bright neutral lighting, slow elegant movement, fresh minimal set design and polished beauty-ad cinematography. Keep the product shape consistent across shots.",
    style: "cinematic-realism",
    aspectRatio: "16:9",
    durationSeconds: 20,
    modelId: "runway-4-5"
  },
  {
    slug: "anime-neon-city",
    title: "Anime Girl in Neon City",
    category: "Anime",
    description: "Emotional anime storytelling in a rainy neon city.",
    prompt: "An anime-style cinematic short scene of a young woman standing beneath neon signs in a futuristic city at night. Rain falls lightly, wind moves her hair and glowing reflections cover the wet street. Build a short emotional beat around someone she is waiting for. High-detail anime look, expressive face, dynamic camera and consistent costume.",
    style: "anime",
    aspectRatio: "16:9",
    durationSeconds: 24,
    modelId: "wan-3-0"
  },
  {
    slug: "3d-birthday-celebration",
    title: "3D Birthday Celebration",
    category: "3D Animation",
    description: "A cheerful family-friendly birthday sequence.",
    prompt: "A joyful stylized 3D animated birthday celebration. A young girl stands beside a colorful birthday cake while family and friends gather around, sing, clap and cheer. End with her blowing out the candles. Bright expressive animation, appealing character design, warm family atmosphere and consistent character appearance.",
    style: "3d-animation",
    aspectRatio: "16:9",
    durationSeconds: 24,
    modelId: "wan-3-0"
  },
  {
    slug: "fantasy-warrior-awakening",
    title: "Fantasy Warrior Awakening",
    category: "Fantasy",
    description: "An epic character introduction in a ruined temple.",
    prompt: "A cinematic fantasy sequence in an ancient ruined temple at dawn. A lone warrior awakens beside a broken stone altar, discovers a glowing symbol on their hand and walks toward a vast doorway as wind moves through the ruins. Epic scale, realistic fantasy production design, dramatic camera movement and consistent armor.",
    style: "cinematic-realism",
    aspectRatio: "16:9",
    durationSeconds: 32,
    modelId: "wan-3-0"
  },
  {
    slug: "pet-storybook-adventure",
    title: "Pet Storybook Adventure",
    category: "3D Animation",
    description: "A gentle animated adventure for family audiences.",
    prompt: "A charming stylized 3D animated story about a small dog following a paper airplane through a bright neighborhood park. The dog meets friendly animals, crosses a tiny bridge and finally returns the airplane to a child. Soft colorful lighting, expressive animation, warm family tone and consistent character design.",
    style: "3d-animation",
    aspectRatio: "16:9",
    durationSeconds: 32,
    modelId: "wan-3-0"
  },
  {
    slug: "cyberpunk-hero-entrance",
    title: "Cyberpunk Hero Entrance",
    category: "Sci-Fi",
    description: "A bold futuristic character reveal with neon atmosphere.",
    prompt: "A cinematic cyberpunk hero entrance in a narrow neon-lit alley filled with mist, holographic signs and reflective wet pavement. A futuristic character walks toward camera with calm confidence as vehicles pass in the distance. Dynamic camera movement, rich atmosphere, realistic wardrobe detail and consistent character identity.",
    style: "cinematic-realism",
    aspectRatio: "16:9",
    durationSeconds: 24,
    modelId: "wan-3-0"
  }
];

export function getShowcaseTemplate(slug?: string) {
  if (!slug) return undefined;
  return showcaseTemplates.find((item) => item.slug === slug);
}
