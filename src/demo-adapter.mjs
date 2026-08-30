export function createInstagramDemoAdapter() {
  return { async process(item, context) {
    const caption = String(item.caption || '');
    return {
      ok: true,
      id: `ig-${context.index + 1}`,
      label: item.file,
      scheduledFor: null,
      steps: [
        { name: 'validate-fixture', status: 'passed', detail: 'Synthetic filename and caption accepted.' },
        { name: 'prepare-reel', status: 'passed', detail: `${caption.length} caption characters prepared.` },
        { name: 'tag-location', status: item.location ? 'passed' : 'skipped', detail: item.location ? `Synthetic location selected: ${item.location}.` : 'No location requested.' },
        { name: 'simulate-share', status: 'simulated', detail: 'No browser was opened and Instagram was not contacted.' },
        { name: 'persist-resume-state', status: 'simulated', detail: 'The mock marks this fixture item complete for a resumable batch.' },
      ],
    };
  } };
}
