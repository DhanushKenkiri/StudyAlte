# YouTube Learning Platform

A React-based web application that transforms YouTube videos into interactive learning experiences using AI-powered content generation.

## Features

- 🎥 **Video Processing**: Extract and analyze YouTube video content
- 🤖 **AI-Generated Materials**: Automatic summaries, flashcards, quizzes, and mind maps
- 📚 **Interactive Learning**: Spaced repetition, progress tracking, and personalized study sessions
- 💬 **AI Tutor**: Contextual chat interface for questions about video content
- 🔍 **Smart Organization**: Search, tag, and categorize learning materials
- 📊 **Progress Analytics**: Track learning performance and insights
- 🔐 **Secure Authentication**: AWS Cognito-based user management

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Material-UI (MUI)** for components
- **Redux Toolkit** for state management
- **React Query** for server state
- **Framer Motion** for animations

### Backend
- **AWS Lambda** (Node.js/TypeScript)
- **AWS API Gateway** for REST APIs
- **AWS DynamoDB** for data storage
- **AWS S3** for file storage
- **AWS Cognito** for authentication

### AI/ML Services
- **AWS Transcribe** for speech-to-text
- **AWS Comprehend** for NLP analysis
- **AWS Bedrock (Claude)** for content generation

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- AWS CLI configured
- AWS CDK CLI installed

### Installation

1. Clone the repository:
\`\`\`bash
git clone <repository-url>
cd youtube-learning-platform
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Copy environment variables:
\`\`\`bash
cp .env.example .env
\`\`\`

4. Update the \`.env\` file with your AWS and API credentials.

### Development

1. Start the development server:
\`\`\`bash
npm run dev
\`\`\`

2. Run tests:
\`\`\`bash
npm test
\`\`\`

3. Run linting:
\`\`\`bash
npm run lint
\`\`\`

### AWS Infrastructure

1. Deploy the AWS infrastructure:
\`\`\`bash
cd infrastructure
npx cdk deploy
\`\`\`

2. Update your \`.env\` file with the output values from the CDK deployment.

## Project Structure

\`\`\`
src/
├── components/          # React components
│   ├── auth/           # Authentication components
│   ├── common/         # Shared components
│   ├── layout/         # Layout components
│   └── learning/       # Learning-specific components
├── hooks/              # Custom React hooks
├── pages/              # Page components
├── services/           # API and external services
├── store/              # Redux store and slices
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── test/               # Test utilities and setup
\`\`\`

## Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run test\` - Run tests
- \`npm run test:coverage\` - Run tests with coverage
- \`npm run lint\` - Run ESLint
- \`npm run lint:fix\` - Fix ESLint issues
- \`npm run format\` - Format code with Prettier
- \`npm run type-check\` - Run TypeScript type checking

## Contributing

1. Follow the established code style (ESLint + Prettier)
2. Write tests for new features
3. Ensure all tests pass and coverage is maintained
4. Follow conventional commit messages

## License

This project is licensed under the MIT License.