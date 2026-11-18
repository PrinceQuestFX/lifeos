# LIFEOS — état d'implémentation

## Réellement testé (12 tests, `npm test`)
Filtrage Groupe A/1 · horaires de nuit 18h–02h (1 période de 8 h) · modification d'un jour · d'une semaine (modèle temporaire) · exceptions (off, heures sup.) · conflits cours/travail · activités simultanées sans double comptage · heures libres · planner.
Les modules `lib/time`, `work`, `availability`, `groups`, `planner` passent aussi `tsc --strict`.

## Écrit mais NON compilé / NON testé ici (pas de réseau → pas de `npm install`)
Toutes les pages React (`app/**`), l'auth, les écritures Supabase, l'import PDF, la route IA.
Attendez-vous à quelques erreurs de type ou d'import au premier `npm run build` : à corriger au fil de l'eau.

## Limites connues
- Import PDF : analyse heuristique (date + plage horaire par ligne). Le format réel des PDF HESTIM doit être validé ; l'écran de contrôle sert à corriger. OCR non inclus (PDF texte uniquement).
- Export PDF = fenêtre d'impression du navigateur (« Enregistrer en PDF »).
- shadcn/ui non installé : composants Tailwind maison (`components/ui.tsx`).
- Planner : glouton par priorité ; les objectifs/tâches ne sont pas encore convertis automatiquement en besoins.
- Assistant IA : nécessite ANTHROPIC_API_KEY ou OPENAI_API_KEY côté serveur.

## À connecter
1. Projet Supabase → exécuter `supabase/migrations/001_lifeos.sql`
2. `.env.local` (voir `.env.example`)
3. `npm install && npm run dev`
