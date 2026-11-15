import { AVAILABLE_TEMPLATES } from './menu-templates';
import { TEMPLATE_COLLECTIONS, templateCollections } from './template-collections';

describe('template browsing collections', () => {
  it('assigns every available template exactly once, without unknown keys', () => {
    const keys = TEMPLATE_COLLECTIONS.flatMap(group => [...group.templates]);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual(AVAILABLE_TEMPLATES.map(template => template.key).sort());
  });
  it('keeps the publication classification separate from browsing groups', () => {
    for (const access of ['simple', 'thematic'] as const) {
      const templates = templateCollections(access).flatMap(group => group.templates);
      expect(templates.map(template => template.key).sort()).toEqual(AVAILABLE_TEMPLATES.filter(template => (template.category ?? 'simple') === access).map(template => template.key).sort());
      expect(templateCollections(access).every(group => group.templates.length > 0)).toBe(true);
    }
  });
  it('combines style and access filters without changing the template settings', () => {
    const groups = templateCollections('simple','digital');
    expect(groups).toHaveLength(1);
    expect(groups[0].templates.map(template => template.key)).toEqual(['liquid-glass']);
    expect(groups[0].templates[0]).toBe(AVAILABLE_TEMPLATES.find(template => template.key === 'liquid-glass')!);
  });
});
