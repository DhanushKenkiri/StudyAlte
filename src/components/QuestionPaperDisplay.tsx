import React from 'react';
import { QuestionPaper, Question } from '../services/bedrockService';
import { MathContent, GraphContent, TableContent, DiagramContent } from './MathComponents';
import { Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface QuestionPaperDisplayProps {
  questionPaper: QuestionPaper;
}

interface QuestionDisplayProps {
  question: Question;
}

const QuestionDisplay: React.FC<QuestionDisplayProps> = ({ question }) => {
  return (
    <div className="question-display">
      <div className="question-header">
        <span className="question-number">Q{question.questionNumber}.</span>
        <span className="question-marks">[{question.marks} marks]</span>
        <span className="question-type">{question.questionType}</span>
      </div>
      
      <div className="question-text">
        {question.question}
      </div>

      {question.mathContent && (
        <div className="question-math">
          <MathContent 
            latex={question.mathContent.latex}
            equations={question.mathContent.equations}
            integrals={question.mathContent.integrals}
          />
          <GraphContent graphs={question.mathContent.graphs} />
          <TableContent tables={question.mathContent.tables} />
        </div>
      )}

      {question.visualContent && (
        <div className="question-visual">
          <DiagramContent diagrams={question.visualContent.diagrams} />
        </div>
      )}

      {question.options && question.options.length > 0 && (
        <div className="question-options">
          {question.options.map((option, index) => (
            <div key={index} className="option-item">
              <span className="option-label">{String.fromCharCode(65 + index)})</span>
              <span className="option-text">{option}</span>
            </div>
          ))}
        </div>
      )}

      {question.bloomLevel && (
        <div className="bloom-level">
          <span className="bloom-label">Bloom's Level:</span>
          <span className="bloom-value">{question.bloomLevel}</span>
        </div>
      )}
    </div>
  );
};

export const QuestionPaperDisplay: React.FC<QuestionPaperDisplayProps> = ({ questionPaper }) => {
  // Debug logging
  console.log('📄 QuestionPaperDisplay received:', questionPaper);
  console.log('📄 Sections:', questionPaper?.sections);
  console.log('📄 Total sections:', questionPaper?.sections?.length);
  
  if (questionPaper?.sections) {
    questionPaper.sections.forEach((section, index) => {
      console.log(`📄 Section ${index}:`, section);
      console.log(`📄 Section ${index} questions:`, section.questions);
      console.log(`📄 Section ${index} question count:`, section.questions?.length);
    });
  }
  const downloadAsPDF = async () => {
    const element = document.getElementById('question-paper-content');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${questionPaper.subject}_Question_Paper.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const downloadAsJSON = () => {
    const dataStr = JSON.stringify(questionPaper, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${questionPaper.subject}_Question_Paper_${new Date().toISOString().slice(0, 10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="question-paper-container">
      <div className="paper-header">
        <h3 className="paper-title">📄 Generated Question Paper</h3>
        <div className="paper-actions">
          <button 
            className="download-pdf-button"
            onClick={downloadAsPDF}
            title="Download as PDF"
          >
            <FileText size={16} />
            PDF
          </button>
          <button 
            className="download-json-button"
            onClick={downloadAsJSON}
            title="Download as JSON"
          >
            <Download size={16} />
            JSON
          </button>
        </div>
      </div>

      <div id="question-paper-content" className="question-paper-content">
        <div className="paper-title-section">
          <h1 className="main-title">{questionPaper.title}</h1>
          <div className="paper-meta">
            <div className="meta-row">
              <span><strong>Subject:</strong> {questionPaper.subject}</span>
              <span><strong>Duration:</strong> {questionPaper.duration}</span>
              <span><strong>Total Marks:</strong> {questionPaper.totalMarks}</span>
            </div>
            <div className="meta-row">
              <span><strong>Generated by:</strong> {questionPaper.generatedBy}</span>
              <span><strong>Date:</strong> {new Date(questionPaper.timestamp).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {questionPaper.instructions && questionPaper.instructions.length > 0 && (
          <div className="general-instructions">
            <h3>General Instructions:</h3>
            <ul>
              {questionPaper.instructions.map((instruction, index) => (
                <li key={index}>{instruction}</li>
              ))}
            </ul>
          </div>
        )}

        {questionPaper.sections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="paper-section">
            <div className="section-header">
              <h2 className="section-title">{section.sectionName}</h2>
              <span className="section-marks">({section.totalMarks} marks)</span>
            </div>
            
            {section.instructions && (
              <div className="section-instructions">
                <em>{section.instructions}</em>
              </div>
            )}

            <div className="section-questions">
              {section.questions.map((question, questionIndex) => (
                <QuestionDisplay key={questionIndex} question={question} />
              ))}
            </div>
          </div>
        ))}

        {questionPaper.answerKey && (
          <div className="answer-key-section">
            <h2>Answer Key & Marking Scheme</h2>
            {questionPaper.answerKey.solutions.map((solution, index) => (
              <div key={index} className="solution-item">
                <h4>Q{solution.questionNumber} Solution:</h4>
                <div className="solution-text">{solution.solution}</div>
                {solution.markingScheme && (
                  <div className="marking-scheme">
                    <strong>Marking Scheme:</strong> {solution.markingScheme}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {questionPaper.metadata && (
          <div className="paper-metadata">
            <h3>Paper Metadata</h3>
            <div className="metadata-grid">
              <div><strong>Difficulty:</strong> {questionPaper.metadata.difficulty}</div>
              <div><strong>Estimated Time:</strong> {questionPaper.metadata.estimatedTime}</div>
              <div><strong>Generated:</strong> {new Date(questionPaper.metadata.timestamp).toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
