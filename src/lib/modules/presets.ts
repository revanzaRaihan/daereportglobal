import { LearningFramework } from './types'

export const SYSTEM_FRAMEWORK_PRESETS: Omit<LearningFramework, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    uid: '01JFRMK01MERDEKACP00000001',
    branch_id: null,
    code: 'kurikulum_merdeka',
    name: 'Kurikulum Merdeka (CP / TP / ATP)',
    is_active: true,
    schema_structure: {
      standard: 'Kurikulum Merdeka Indonesia',
      elements: [
        'Capaian Pembelajaran (CP)',
        'Tujuan Pembelajaran (TP)',
        'Alur Tujuan Pembelajaran (ATP)',
        'Dimensi Profil Pelajar Pancasila'
      ],
      description: 'Struktur kurikulum nasional Indonesia berbasis capaian pembelajaran esensial, diferensiasi siswa, dan penguatan karakter Profil Pelajar Pancasila.'
    }
  },
  {
    uid: '01JFRMK02CAMBRIDGELP000002',
    branch_id: null,
    code: 'cambridge',
    name: 'Cambridge International Curriculum',
    is_active: true,
    schema_structure: {
      standard: 'Cambridge Assessment International Education',
      elements: [
        'Learning Objectives (Stage/Progression)',
        'Success Criteria',
        'Key Scientific & Mathematical Terminology',
        'Global Perspectives & Inquiry'
      ],
      description: 'Internationally recognized British curriculum focusing on deep subject knowledge, conceptual understanding, and critical higher-order thinking skills.'
    }
  },
  {
    uid: '01JFRMK03IBPYPMYP00000003',
    branch_id: null,
    code: 'ib',
    name: 'International Baccalaureate (IB PYP / MYP)',
    is_active: true,
    schema_structure: {
      standard: 'International Baccalaureate Organization',
      elements: [
        'Central Idea / Inquiry Statement',
        'Lines of Inquiry',
        'Learner Profile Attributes',
        'Key & Related Concepts (Form, Function, Causation)'
      ],
      description: 'Inquiry-driven transdisciplinary framework developing inquiring, knowledgeable, and caring young people who help to create a better world.'
    }
  },
  {
    uid: '01JFRMK04ISTECSTA00000004',
    branch_id: null,
    code: 'iste_csta',
    name: 'ISTE & CSTA Computer Science Standards',
    is_active: true,
    schema_structure: {
      standard: 'CSTA & ISTE Standards for Students',
      elements: [
        'Computational Thinking (Decomposition, Pattern, Abstraction, Algorithm)',
        'CSTA Core Concepts: Algorithms & Programming, Data & Analysis',
        'Hands-on Debugging, Iteration & Creative Artifact Building',
        'Digital Citizenship & Collaborative Problem Solving'
      ],
      description: 'Premier curriculum standard for coding academies, robotics labs, and STEM education focusing on computational problem-solving and software logic.'
    }
  },
  {
    uid: '01JFRMK05COMMONCORE000005',
    branch_id: null,
    code: 'common_core',
    name: 'Common Core State Standards (CCSS)',
    is_active: true,
    schema_structure: {
      standard: 'US Common Core State Standards',
      elements: [
        'Domain, Cluster & Standard Codes',
        'Mathematical / ELA Practice Standards',
        'Essential Questions & Real-World Application',
        'Performance Assessment Criteria'
      ],
      description: 'US standardized academic benchmark outlining what students should understand and be able to do in mathematics and English language arts.'
    }
  }
]
