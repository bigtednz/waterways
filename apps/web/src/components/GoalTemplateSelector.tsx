import { goalTemplates, GoalTemplate } from "../lib/goalTemplates";

interface GoalTemplateSelectorProps {
  onSelect: (template: GoalTemplate) => void;
}

export function GoalTemplateSelector({ onSelect }: GoalTemplateSelectorProps) {
  const categories = ["performance", "penalty", "consistency", "completion"] as const;
  
  return (
    <div className="space-y-6">
      {categories.map(category => {
        const templates = goalTemplates.filter(t => t.category === category);
        if (templates.length === 0) return null;
        
        return (
          <div key={category}>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 capitalize">
              {category} Goals
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => onSelect(template)}
                  className="text-left p-4 bg-gradient-to-br from-white to-gray-50 rounded-lg border-2 border-gray-200 hover:border-purple-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{template.icon}</span>
                    <div className="flex-1">
                      <h5 className="font-semibold text-gray-900 mb-1">{template.name}</h5>
                      <p className="text-xs text-gray-600 mb-2">{template.description}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                          Target: {template.defaultTarget} {template.defaultUnit}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
