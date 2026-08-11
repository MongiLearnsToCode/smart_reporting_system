import { ProjectsSettings } from '@/components/projects-settings';

export const metadata = { title: 'Projects | Codex' };

export default function ProjectsPage() {
  return (
    <div className="space-y-3">
      {/* Projects are content, not preferences — every control on this tab saves
          the moment it is used, with no Save button to press. */}
      <p className="text-xs text-zinc-500">
        Projects file your entries into separate streams. Changes here save immediately.
      </p>
      <ProjectsSettings />
    </div>
  );
}
