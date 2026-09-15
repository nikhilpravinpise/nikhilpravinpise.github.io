// Single source of truth for every fact and URL shown on the page.
// Commands, the footer, the <noscript> block, neofetch and the README
// command table all derive from this (consistency tests enforce it).

export const PROFILE = {
  version: "3.0.0",
  name: "Nikhil Pravin Pise",
  handle: "nikhilpravinpise",
  host: "github",
  prompt: "nikhil@github:~$",
  site: "https://nikhilpravinpise.github.io/",
  agent: "nikhil-agent v3.0",
  agentTag: "AI/ML Researcher",
  email: "nikhilpise2006@gmail.com",
  avatar: "https://github.com/nikhilpravinpise.png",
  tagline:
    "Pre-final CS (Data Science) @ DJSCE · ML Research Intern @ IIT Guwahati · AI/ML Builder",
  links: {
    portfolio: "https://nikhilpise.tech",
    resume:
      "https://drive.google.com/file/d/1Ko71VMfA1KPwpCn1ZUlVsdhpl9jxbSo_/view?usp=sharing",
    linkedin: "https://linkedin.com/in/nikhil-pravin-pise",
    github: "https://github.com/nikhilpravinpise",
  },
  whoami: [
    "Pre-final year CS (Data Science) @ SVKM's DJSCE, 9.14 CGPA, based in Mumbai, IN",
    "Currently: Summer ML Research Intern @ IIT Guwahati · Head of ML @ DJS S4DS",
    "3x Hackathon Winner · 8+ National Hackathon Finalist",
    "3 preliminary asteroid discoveries (IASC x NASA) · builds AI agents & on-device ML",
  ],
  experience: [
    ["Jun 2026 - now", "Summer ML Research Intern", "IIT Guwahati"],
    ["Jul 2026 - now", "Head of ML", "DJS S4DS"],
    ["Sept 2024 - now", "B.Tech CSE (Data Science)", "SVKM's DJSCE"],
  ],
  skills: [
    [
      "languages",
      "Python, C/C++, Java, JavaScript (ES6+), Dart, SQL, Bash, HTML5, CSS3",
    ],
    [
      "frameworks",
      "PyTorch, TensorFlow, Scikit-Learn, Hugging Face, LangGraph, Flask, FastAPI, React, Flutter, Docker, Git",
    ],
    [
      "ai / ml",
      "LLMs, RAG, AI Agents, MCP, On-Device LLMs, GraphQL, REST APIs, OAuth, Webhooks",
    ],
  ],
  projects: [
    [
      "Cairn",
      "Offline FEMA building triage - Gemma 4 (2B) fully on-device via LiteRT-LM",
      "https://github.com/nikhilpravinpise/Cairn",
    ],
    [
      "Project Aether",
      "GraphQL-first Medium scraper - Apify Actor + MCP server + Gradio UI, 15x faster",
      "https://github.com/nikhilpravinpise/Medium-Agent",
    ],
    [
      "Parmar",
      "AI outbound sales qualification - Vapi voice agent + Twilio WhatsApp alerts",
      "https://github.com/nikhilpravinpise/Parmar",
    ],
    [
      "ZerveChurn",
      "SaaS churn prediction - 409K events, PyTorch GraphSAGE, 0.94 ROC-AUC",
      "https://github.com/nikhilpravinpise/ZerveChurn",
    ],
  ],
  // neofetch card contents
  system: {
    editor: "VS Code",
    shell: "nsh (not a real shell)",
    location: "Mumbai, IN",
  },
};

export const BANNER = `    _   ________ __ __  ________       ____  _________ ______
   / | / /  _/ //_// / / /  _/ /      / __ \\/  _/ ___// ____/
  /  |/ // // ,<  / /_/ // // /      / /_/ // / \\__ \\/ __/   
 / /|  // // /| |/ __  // // /___   / ____// / ___/ / /___   
/_/ |_/___/_/ |_/_/ /_/___/_____/  /_/   /___//____/_____/   `;

// compact variant shown on narrow screens (<=520px)
export const BANNER_SM = ` _  _  ___  _  _  _  _  ___  _      ___  ___  ___  ___
| \\| ||_ _|| |/ /| || ||_ _|| |    | _ \\|_ _|/ __|| __|
| .\` | | | | ' < | __ | | | | |__  |  _/ | | \\__ \\| _|
|_|\\_|___| |_|\\_\\|_||_|___||____| |_|  |___||___/|___|`;
