# 🎓 AI Question Paper Generator

A React TypeScript application that serves as an AI Question Paper Generator with ChatGPT-style interface, file upload capabilities, Google Gemini API integration, and AWS Bedrock agent orchestration for specialized question paper generation.

## ✨ Features

- **ChatGPT-style Interface**: Modern, responsive chat interface with real-time messaging
- **Multi-file Upload**: Support for PDF, DOC, DOCX, PPT, PPTX, TXT, and image files
- **AI-Powered Analysis**: Intelligent content analysis using Google Gemini API
- **Smart Prompt Generation**: Creates comprehensive prompts for question paper generation
- **AWS Bedrock Integration**: Specialized AI agents for different subjects (Mathematics, Physics, Chemistry, etc.)
- **Question Extraction**: Extracts questions from uploaded documents as reference patterns
- **Complete Question Papers**: Generates full question papers with proper formatting, sections, and answer keys
- **JSON Export**: Download generated prompts and question papers for external use
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## 🚀 Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn
- Google Gemini API key
- AWS Account with Bedrock access
- Configured Bedrock agents for different subjects
- Firebase project with Authentication and Realtime Database enabled

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd questionpaperanalyser
```

2. Install dependencies:
```bash
npm install
```

3. **Set up Firebase Project:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or use an existing one
   - Enable **Authentication** and set up **Google Sign-in** provider
   - Enable **Realtime Database** and set up basic security rules
   - Get your Firebase config from Project Settings > General > Your apps

4. Configure environment variables:
```bash
cp .env.example .env
```
Edit `.env` and add your Firebase config, API keys, and Bedrock agent IDs:

```env
# Firebase Configuration (Required)
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:your-app-id

# Other API keys...
```

5. Start the development server:
```bash
npm start
```

5. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Gemini API Configuration
REACT_APP_GEMINI_API_KEY=your-gemini-api-key

# AWS Bedrock Configuration
REACT_APP_AWS_ACCESS_KEY_ID=your-aws-access-key
REACT_APP_AWS_SECRET_ACCESS_KEY=your-aws-secret-key
REACT_APP_AWS_REGION=your-aws-region

# AWS Bedrock Configuration
REACT_APP_AWS_ACCESS_KEY_ID=your-aws-access-key
REACT_APP_AWS_SECRET_ACCESS_KEY=your-aws-secret-key
REACT_APP_AWS_REGION=eu-north-1

# Bedrock Agents Configuration (Your actual agent names)
REACT_APP_BEDROCK_AGENT_MATHEMATICS=Agent_MathStats
REACT_APP_BEDROCK_AGENT_DATA_SCIENCE=Agent_DataSci
REACT_APP_BEDROCK_AGENT_MECHANICAL_ENGINEERING=Agent_MechEng
REACT_APP_BEDROCK_AGENT_ELECTRICAL_ENGINEERING=Agent_ElecEng
REACT_APP_BEDROCK_AGENT_CIVIL_ENGINEERING=Agent_CivilEng
REACT_APP_BEDROCK_AGENT_CHEMISTRY=Agent_ChemEng
REACT_APP_BEDROCK_AGENT_ECONOMICS=Agent_Econ
REACT_APP_BEDROCK_AGENT_COMPUTER_SCIENCE=Agent_CompSci
REACT_APP_BEDROCK_AGENT_COLLABORATOR=Agent_Collaborater
REACT_APP_BEDROCK_AGENT_GENERAL=DEMO
# ... add more agents as needed
```

## 🛠️ Technical Stack

- **Frontend**: React 18+ with TypeScript
- **Icons**: Lucide React
- **Styling**: Pure CSS with modern design
- **File Handling**: HTML5 File API with drag-and-drop support
- **AI Integration**: Google Gemini API + AWS Bedrock Agents
- **Build Tool**: React Scripts
- **Cloud Services**: AWS Bedrock for specialized AI agents

## 📁 Project Structure

```
src/
├── App.tsx                 # Main chat interface component
├── App.css                 # Modern styling and responsive design
├── index.tsx               # React entry point
└── services/
    ├── geminiService.ts    # Google Gemini AI integration
    └── bedrockService.ts   # AWS Bedrock agent orchestration
```

## 🎯 How to Use

1. **Upload Files**: Click the paperclip icon to upload educational materials
2. **Describe Requirements**: Type your question paper requirements (e.g., "Create 4 questions of 5 marks each")
3. **Get Analysis**: Receive AI-powered content analysis with extracted questions and patterns
4. **Generate Paper**: Click "Generate Paper" to use specialized AI agents for creating complete question papers
5. **Download**: Export the generated question papers and prompts as JSON

## 📊 Supported File Types

- **Documents**: PDF, DOC, DOCX, TXT
- **Presentations**: PPT, PPTX
- **Images**: JPG, JPEG, PNG, GIF

## 🤖 AI Features

### Gemini AI Analysis
- **Content Analysis**: Automatic subject detection and topic identification
- **Question Extraction**: Pulls questions from uploaded documents
- **Pattern Recognition**: Identifies question patterns and formats
- **Requirements Parsing**: Understands user requirements and specifications

### Bedrock Agent Orchestration
- **Subject-Specific Agents**: 
  - **Agent_MathStats**: Mathematics & Statistics
  - **Agent_DataSci**: Data Science & Machine Learning
  - **Agent_MechEng**: Mechanical Engineering
  - **Agent_ElecEng**: Electrical Engineering
  - **Agent_CivilEng**: Civil Engineering
  - **Agent_ChemEng**: Chemical Engineering
  - **Agent_Econ**: Economics & Finance
  - **Agent_CompSci**: Computer Science
  - **Agent_Collaborater**: Interdisciplinary Projects
  - **DEMO**: General Academic Topics
- **Intelligent Routing**: Automatically selects the best agent based on content analysis
- **Complete Paper Generation**: Creates full question papers with proper formatting
- **Answer Key Generation**: Includes marking schemes and answer keys

## 🎨 UI/UX Features

- **Modern Design**: Clean, minimalist interface with smooth animations
- **Responsive Layout**: Optimized for all screen sizes
- **Accessibility**: ARIA labels, focus states, and keyboard navigation
- **Loading States**: Visual feedback during processing
- **File Management**: Easy file upload and removal

## 📱 Responsive Design

The application is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile devices
- Various screen resolutions

## 🔧 Customization

### Styling
The application uses pure CSS with CSS custom properties for easy theming. Main colors:
- Primary: `#3b82f6` (Blue)
- Success: `#10b981` (Green)
- Background: `#f8fafc` (Light Gray)
- Text: `#1f2937` (Dark Gray)

### API Integration
The Gemini service is modular and can be extended or replaced with other AI providers by modifying `src/services/geminiService.ts`.

## 🚧 Development

### Available Scripts

- `npm start`: Runs the app in development mode
- `npm build`: Builds the app for production
- `npm test`: Launches the test runner
- `npm eject`: Ejects from Create React App (one-way operation)

### Adding New Features

1. **New File Types**: Update the `supportedTypes` array in `App.tsx`
2. **Custom Analysis**: Extend the `GeminiService` class
3. **UI Components**: Add new components in the `src/components` directory
4. **Styling**: Update `App.css` or add component-specific CSS files

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

If you encounter any issues:

1. Check that your Gemini API key is valid
2. Ensure uploaded files are in supported formats
3. Check the browser console for error messages
4. Verify your internet connection

## 🎉 Success Criteria

This application successfully:
- ✅ Allows seamless file upload and text input
- ✅ Generates intelligent AI prompts from content analysis
- ✅ Provides downloadable JSON for external AI systems
- ✅ Handles multiple file types including images
- ✅ Offers a professional, ChatGPT-like user experience
- ✅ Supports educational content across various subjects
- ✅ Generates prompts that create relevant, exam-predictive questions

## 🔮 Future Enhancements

- **Template Library**: Pre-built question paper templates
- **Batch Processing**: Process multiple document sets
- **Export Formats**: Additional export options (Word, PDF)
- **Collaboration**: Share and collaborate on question papers
- **Analytics**: Track usage and improve prompt generation
