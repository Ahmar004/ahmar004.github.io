/**
 * Single source of truth for every piece of portfolio content.
 *
 * Both the 3D crate targets and the HTML sections below the playfield are
 * generated from this file. To update the site after a resume change, edit
 * here and nowhere else.
 */

export const profile = {
  name: 'Ahmar Ali',
  fullName: 'Syed Ahmar Ali',
  title: 'Full Stack Engineer · Open-Source Developer · Computer Vision & ML',
  location: 'Islamabad, Pakistan',
  email: 'ahmarali2004@gmail.com',
  phone: '+92 308 5602065',
  github: 'https://github.com/Ahmar004',
  githubHandle: 'github.com/Ahmar004',
  linkedin: 'https://linkedin.com/in/ahmarali2004/',
  resume: './Ahmar_Ali_Resume.pdf',
  blurb:
    'CS student at FAST-NUCES building full-stack products and computer-vision systems. Founder of two open-source communities with 2,500+ members.',
  roles: [
    'full stack engineer',
    'open-source developer',
    'computer vision & ml',
    'cuda programmer',
    'cs student @ fast-nuces',
  ],
  stats: [
    { value: 2500, suffix: '+', label: 'Community members' },
    { value: 3, suffix: '', label: 'Internships & fellowships' },
    { value: 12, suffix: '+', label: 'Projects shipped' },
    { value: 2, suffix: '', label: 'Medals at FAST' },
  ],
};

/**
 * Each entry becomes one hanging crate in the playfield and one section below.
 * `accent` drives both the bird/debris colour and the section's highlight.
 * `hidden: true` crates start tucked behind the beam as an easter egg.
 */
export const sections = [
  {
    id: 'experience',
    label: 'EXPERIENCE',
    icon: '💼',
    accent: '#4fc3f7',
    title: "Where I've Worked",
    kicker: '01 · Experience',
    intro: 'Internships, mentorship, and the open-source work that taught me the most.',
    type: 'timeline',
    items: [
      {
        role: 'TLDP Mentor',
        org: 'Baruch College — City University of New York',
        meta: 'Remote, USA',
        period: 'Aug 2026 – Nov 2026',
        current: true,
        bullets: [
          'Coaching and mentoring a student through the Technical Leadership Development Program, providing technical guidance and career direction.',
          'Running monthly feedback and collaboration sessions to track progress against goals.',
        ],
      },
      {
        role: 'Full Stack Software Engineer Intern',
        org: 'CitrusBits',
        meta: 'Islamabad, Pakistan · On-site',
        period: 'Jun 2026 – Aug 2026',
        bullets: [
          'Built <strong>Pulse</strong>, an attendance management system in Express, Node, React and PostgreSQL — rolling out company-wide to 200+ people as the replacement for spreadsheet-based attendance.',
          'Worked across REST API design, Redux Toolkit and Jotai state, React hooks and expensive-computation optimisation, Next.js file-based routing, and browser storage strategies.',
          'Compared rendering strategies in production — SPA, SSR, ISR and SSG — and tuned pages against Lighthouse metrics.',
          'Shipped in a Scrum team using Jira for delivery and Slack for communication.',
        ],
      },
      {
        role: 'Open-Source Developer',
        org: 'GitHub — self-employed',
        meta: 'Remote',
        period: 'Apr 2025 – Present',
        current: true,
        bullets: [
          'Founded and maintain <strong>OFR</strong> (Open-Source FAST Repository), where 1,700+ students save and share course resources.',
          'Founded and maintain <strong>OCR</strong> (Open-Source CS Repository), an 800+ member hub for learning computer science through curated free resources.',
          'Automated contributor workflows with GitHub Actions so the communities scale without manual review bottlenecks.',
          'Collaborated with two developers to rebuild the <strong>Palestine-Bleeds</strong> UI in React.',
        ],
      },
      {
        role: 'Software Engineering Fellow',
        org: 'HeadStarter.ai',
        meta: 'Remote, USA',
        period: 'Jul 2024 – Aug 2024',
        bullets: [
          'Selected for a competitive fellowship built around shipping production-grade projects at pace.',
          'Mentored by senior tech founders on engineering practice, community outreach and portfolio craft.',
        ],
      },
      {
        role: 'Tier-3 Research Team Member',
        org: 'Colab-NU Research Lab — FAST-NUCES',
        meta: 'On-campus, Islamabad',
        period: 'Sep 2023 – Jun 2024',
        bullets: [
          "Researched and presented CS topics including Dijkstra's algorithm, with written documentation each cycle.",
          'Reported progress in weekly standups with faculty mentors.',
        ],
      },
    ],
  },

  {
    id: 'projects',
    label: 'PROJECTS',
    icon: '🚀',
    accent: '#34d399',
    title: "Things I've Built",
    kicker: '02 · Projects',
    intro: 'From GPU kernels to drone-based crowd safety — each one started as an obsession.',
    type: 'cards',
    items: [
      {
        name: 'Stampede Detection with Drones',
        featured: true,
        badge: 'Final Year Project',
        icon: '🛸',
        desc: 'Computer-vision system that detects crowd stampede conditions from aerial drone footage in real time. Detection and density models in PyTorch and OpenCV, served through a React and Node dashboard backed by PostgreSQL. Final year project at FAST-NUCES, due April 2027.',
        tags: ['Python', 'PyTorch', 'OpenCV', 'React.js', 'Node.js', 'PostgreSQL', 'REST APIs'],
        link: null,
      },
      {
        name: 'Pulse — Attendance Management System',
        badge: 'CitrusBits',
        icon: '📊',
        desc: 'Full-stack attendance platform replacing spreadsheet workflows for a 200+ person company. Express and PostgreSQL on the back end, React with Redux Toolkit and Jotai on the front.',
        tags: ['React.js', 'Express.js', 'Node.js', 'PostgreSQL', 'Redux Toolkit'],
        link: null,
      },
      {
        name: 'KLT Feature Tracker — HPC Optimisation',
        icon: '⚡',
        desc: 'Took a Kanade–Lucas–Tomasi feature tracker from profile to 4× speedup by moving the compute-heavy passes onto the GPU with CUDA kernels and OpenACC directives.',
        tags: ['CUDA', 'OpenACC', 'Numba', 'Python', 'Profiling'],
        link: 'https://github.com/Ahmar004/HPC_Project',
      },
      {
        name: 'Git-Lite — Version Control in C++',
        icon: '🌳',
        desc: 'A working version control system written from scratch in C++. Content addressing via Merkle trees, with red-black trees indexing the object store for fast lookups.',
        tags: ['C++', 'Merkle Trees', 'Red-Black Trees', 'Data Structures'],
        link: 'https://github.com/Ahmar004',
      },
      {
        name: 'AI Reading Comprehension & Quiz Generator',
        icon: '🧠',
        desc: 'Generates comprehension passages and graded quiz questions automatically, then scores free-text answers against the source material.',
        tags: ['Python', 'NLP', 'Machine Learning'],
        link: 'https://github.com/Ahmar004',
      },
      {
        name: 'OFR — Open-Source FAST Repository',
        icon: '📂',
        oss: true,
        desc: 'Student resource platform for FAST-NUCES serving 1,700+ members, with GitHub Actions automating contribution review.',
        tags: ['Vanilla JS', 'GitHub Actions', 'Community'],
        link: 'https://github.com/Ahmar004/Fast_Repository',
      },
      {
        name: 'OCR — Open-Source CS Repository',
        icon: '🌐',
        oss: true,
        desc: 'An open hub of curated CS learning resources, 800+ members and growing, run entirely through automated PR workflows.',
        tags: ['Vanilla JS', 'GitHub Actions', 'Community'],
        link: 'https://github.com/Ahmar004/OCR',
      },
      {
        name: 'Palestine-Bleeds',
        icon: '🇵🇸',
        oss: true,
        desc: 'Awareness site built and deployed open-source. Rebuilt the interface in React alongside two remote collaborators.',
        tags: ['React.js', 'Node.js', 'Tailwind CSS'],
        link: 'https://ahmar004.github.io/Palestine-Bleeds/',
      },
      {
        name: 'Rent-Ease — Property Platform',
        icon: '🏠',
        desc: 'Rental and property-buying platform with a JavaFX desktop client over a Java service layer. Software Design & Analysis semester project.',
        tags: ['JavaFX', 'Java', 'OOP'],
        link: 'https://github.com/Taha-tech05/Rentify',
      },
      {
        name: 'Xonix — Arcade Multiplayer',
        icon: '🎮',
        desc: 'Fully playable multiplayer arcade game in C++ and SFML, built on hand-rolled data structures for the DSA course.',
        tags: ['C++', 'SFML', 'Data Structures'],
        link: 'https://github.com/Ahmar004/DSA_Project',
      },
      {
        name: 'Cipher — File Encryption',
        icon: '🔒',
        desc: 'Desktop app for encrypting and decrypting files, built in C++ with RayLib during the CodeAlpha internship.',
        tags: ['C++', 'RayLib', 'Cryptography'],
        link: 'https://github.com/Ahmar004',
      },
      {
        name: 'Brute — Plagiarism Detection',
        icon: '🔍',
        desc: 'Plagiarism detector written in plain C, comparing documents by token overlap. First-semester Programming Fundamentals project.',
        tags: ['C', 'Algorithms', 'Text Analysis'],
        link: 'https://github.com/Ahmar004/Programming-Fundamentals/tree/Project',
      },
    ],
  },

  {
    id: 'skills',
    label: 'SKILLS',
    icon: '🛠',
    accent: '#f472b6',
    title: 'Tech Stack',
    kicker: '03 · Skills',
    intro: 'From CUDA kernels to production React.',
    type: 'skills',
    items: [
      {
        group: 'AI / ML & HPC',
        color: '#4fc3f7',
        skills: ['Python', 'PyTorch', 'OpenCV', 'Machine Learning', 'CUDA', 'OpenACC', 'Numba', 'HPC with GPUs'],
      },
      {
        group: 'Web & Full Stack',
        color: '#f472b6',
        skills: ['JavaScript', 'React.js', 'Next.js', 'Node.js', 'Express.js', 'Redux Toolkit', 'Jotai', 'REST APIs', 'Tailwind CSS', 'HTML5'],
      },
      {
        group: 'Data & Systems',
        color: '#fbbf24',
        skills: ['PostgreSQL', 'SQL', 'C', 'C++', 'Java', 'JavaFX', 'SFML', 'RayLib', 'Linux'],
      },
      {
        group: 'Tools & Workflow',
        color: '#34d399',
        skills: ['Git', 'GitHub', 'GitHub Actions', 'Jira', 'Scrum', 'Claude Code', 'Cursor', 'CodeRabbit', 'VS Code', 'Jupyter', 'IntelliJ'],
      },
    ],
  },

  {
    id: 'education',
    label: 'EDUCATION',
    icon: '🎓',
    accent: '#fbbf24',
    title: 'Academic Journey',
    kicker: '04 · Education',
    intro: 'Rigorous practice from day one.',
    type: 'education',
    items: [
      {
        institution: 'FAST — National University of Computer & Emerging Sciences',
        degree: 'B.S. Computer Science',
        period: 'Aug 2023 – May 2027 · Islamabad',
        icon: '🎓',
        note: 'Final Year Project: Stampede Detection with Drones (Computer Vision, ML)',
        awards: [
          { text: '🥇 Gold Medal — Fall 2023', kind: 'gold' },
          { text: '🥉 Bronze Medal — Spring 2024', kind: 'bronze' },
          { text: "★ Dean's List — twice", kind: 'dean' },
        ],
      },
      {
        institution: 'Beacon House School System',
        degree: 'A-Levels · Computer Science',
        period: '2021 – 2023 · Islamabad',
        icon: '📚',
        awards: [],
      },
    ],
  },

  {
    id: 'certificates',
    label: 'CERTIFICATES',
    icon: '🏅',
    accent: '#a78bfa',
    title: 'Certificates & Continuous Learning',
    kicker: '05 · Certificates',
    intro: 'Completed certifications and courses currently in progress.',
    type: 'courses',
    items: [
      {
        name: 'Supervised Machine Learning: Regression and Classification',
        provider: 'DeepLearning.AI · Stanford Online',
        status: 'Certified',
        icon: '🤖',
        link: null,
      },
      {
        name: 'Mastering Data Structures & Algorithms — C & C++',
        provider: 'Udemy',
        status: 'Certified',
        icon: '🏆',
        link: 'https://www.udemy.com/certificate/UC-a9ab07a2-5be5-462c-b69b-6f0f8ab552ef/',
      },
      {
        name: 'The Complete Full-Stack Web Development Bootcamp',
        provider: 'Udemy · Dr. Angela Yu',
        status: 'In progress',
        icon: '🌐',
        link: null,
      },
      {
        name: 'Machine Learning A–Z: AI, Python & R',
        provider: 'Udemy',
        status: 'In progress',
        icon: '📊',
        link: null,
      },
      {
        name: 'The Complete Python Bootcamp: Zero to Hero',
        provider: 'Udemy · Jose Portilla',
        status: 'In progress',
        icon: '🐍',
        link: null,
      },
      {
        name: 'Clustering & Unsupervised Learning in Python',
        provider: 'Udemy',
        status: 'In progress',
        icon: '🔬',
        link: null,
      },
    ],
  },

  {
    id: 'contact',
    label: 'CONTACT ME',
    icon: '✉',
    accent: '#f87171',
    title: "Let's build something remarkable",
    kicker: '06 · Contact',
    intro:
      'Open to full-stack and ML roles, and always up for open-source collaboration. The fastest way to reach me is email.',
    type: 'contact',
    items: [],
  },

  {
    id: 'beyond',
    label: 'BEYOND CODE',
    icon: '🏔',
    accent: '#2dd4bf',
    hidden: true,
    title: "When I'm Not Coding",
    kicker: '07 · Beyond Code',
    intro:
      'Balancing open-source work, university, calisthenics, dawah on YouTube and off-road runs in the Himalayas is harder than any of the projects above.',
    type: 'pills',
    items: [
      '🌙 Dawah',
      '🤸 Calisthenics',
      '🏍 Biking',
      '🏕 Off-road Adventures',
      '🏃 Jogging',
      '🥾 Hiking',
      '🏊 Swimming',
      '🏓 Table Tennis',
      '🌱 Gardening',
    ],
  },
];

/** Crates that hang in the playfield, in left-to-right order. */
export const targets = sections;
