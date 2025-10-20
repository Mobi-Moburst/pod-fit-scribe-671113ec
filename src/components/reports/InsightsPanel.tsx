import { Card } from '@/components/ui/card';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { Lightbulb, AlertTriangle, Target } from 'lucide-react';

interface InsightsPanelProps {
  insights: {
    key_insights?: string[];
    notable_patterns?: string[];
    risk_recommendations?: string[];
    action_items?: string[];
  };
}

export const InsightsPanel = ({ insights }: InsightsPanelProps) => {
  const sections = [
    {
      id: 'insights',
      title: 'Key Insights',
      icon: Lightbulb,
      items: insights.key_insights || [],
      color: 'text-primary'
    },
    {
      id: 'patterns',
      title: 'Notable Patterns',
      icon: Target,
      items: insights.notable_patterns || [],
      color: 'text-accent'
    },
    {
      id: 'risks',
      title: 'Risk Recommendations',
      icon: AlertTriangle,
      items: insights.risk_recommendations || [],
      color: 'text-amber-500'
    },
    {
      id: 'actions',
      title: 'Action Items',
      icon: Target,
      items: insights.action_items || [],
      color: 'text-green-500'
    }
  ];

  return (
    <Card className="p-6 mb-8">
      <h3 className="text-xl font-semibold mb-4">AI-Powered Analysis</h3>
      <Accordion type="multiple" defaultValue={['insights', 'actions']} className="w-full">
        {sections.map((section) => {
          if (!section.items.length) return null;
          
          const Icon = section.icon;
          
          return (
            <AccordionItem key={section.id} value={section.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${section.color}`} />
                  <span className="font-semibold">{section.title}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    ({section.items.length})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 mt-2">
                  {section.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${section.color} bg-current shrink-0`} />
                      <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </Card>
  );
};
