export interface ClientProfile {
  id: string;
  name: string;
  company?: string;
  industry?: string;
  ICP: string;
  target_roles: string[];
  target_company_sizes?: string;
  target_regions?: string;
  topics_to_prioritize: string[];
  topics_to_avoid: string[];
  keywords_positive: string[];
  keywords_negative: string[];
  content_goals: string;
  CTA: string;
  notes?: string;
}

export const mockClients: ClientProfile[] = [
  {
    id: 'c1',
    name: 'Cybersecurity CIO Lead-gen',
    company: 'Acme Security',
    industry: 'Cybersecurity',
    ICP: 'CIOs, CISOs at mid-enterprise (500–5000 employees)',
    target_roles: ['CIO', 'CISO', 'Security Director'],
    target_company_sizes: '500–5000',
    target_regions: 'North America, EU',
    topics_to_prioritize: ['zero trust', 'SOC automation', 'XDR', 'threat intel'],
    topics_to_avoid: ['crypto trading', 'consumer privacy tips'],
    keywords_positive: ['zero trust', 'CISO', 'SOC', 'XDR', 'ransomware'],
    keywords_negative: ['crypto', 'giveaway'],
    content_goals: 'Lead-gen from enterprise security leaders',
    CTA: 'Download our Zero Trust Playbook',
    notes: 'Prefer practitioner-led shows with technical depth.'
  },
  {
    id: 'c2',
    name: 'Health IT Thought Leadership',
    company: 'MedFlow',
    industry: 'Healthcare IT',
    ICP: 'Health system CTOs, informatics leaders',
    target_roles: ['CTO', 'CMIO', 'Informatics Director'],
    target_company_sizes: '1k+ clinicians',
    target_regions: 'US',
    topics_to_prioritize: ['EHR interoperability', 'FHIR', 'clinical workflows'],
    topics_to_avoid: ['supplements', 'consumer wellness fads'],
    keywords_positive: ['FHIR', 'interoperability', 'Epic', 'Cerner'],
    keywords_negative: ['supplement', 'keto'],
    content_goals: 'Establish expertise and invite partnerships',
    CTA: 'Join our interoperability roundtable',
    notes: 'Policy-aware but pragmatic tone preferred.'
  },
  {
    id: 'c3',
    name: 'Fintech Policy & Reg Awareness',
    company: 'FinRegIQ',
    industry: 'Fintech',
    ICP: 'Compliance leaders, policy analysts',
    target_roles: ['Chief Compliance Officer', 'Policy Lead'],
    target_company_sizes: '100–1000',
    target_regions: 'US, UK',
    topics_to_prioritize: ['open banking', 'AML', 'KYC', 'PSD2'],
    topics_to_avoid: ['retail trading hype'],
    keywords_positive: ['AML', 'KYC', 'PSD2', 'compliance'],
    keywords_negative: ['meme stock'],
    content_goals: 'Raise awareness with policy stakeholders',
    CTA: 'Download the compliance checklist',
    notes: 'Sober, policy-forward tone.'
  }
];
