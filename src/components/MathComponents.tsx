import React, { useEffect, useRef } from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import mermaid from 'mermaid';

interface MathContentProps {
  latex?: string;
  equations?: string[];
  integrals?: string[];
  inline?: boolean;
}

interface GraphContentProps {
  graphs?: Array<{
    type: string;
    title: string;
    mermaidCode?: string;
    mathFunction?: string;
    domain?: [number, number];
    range?: [number, number];
  }>;
}

interface TableContentProps {
  tables?: Array<{
    headers: string[];
    rows: string[][];
    caption?: string;
  }>;
}

interface DiagramContentProps {
  diagrams?: Array<{
    type: string;
    mermaidCode?: string;
    description: string;
  }>;
}

export const MathContent: React.FC<MathContentProps> = ({ 
  latex, 
  equations, 
  integrals, 
  inline = false 
}) => {
  if (!latex && !equations && !integrals) return null;

  return (
    <div className="math-content">
      {latex && (
        <div className="latex-content">
          {inline ? <InlineMath math={latex} /> : <BlockMath math={latex} />}
        </div>
      )}
      
      {equations && equations.length > 0 && (
        <div className="equations-list">
          <h6>Equations:</h6>
          {equations.map((equation, index) => (
            <div key={index} className="equation-item">
              <InlineMath math={equation} />
            </div>
          ))}
        </div>
      )}
      
      {integrals && integrals.length > 0 && (
        <div className="integrals-list">
          <h6>Integrals:</h6>
          {integrals.map((integral, index) => (
            <div key={index} className="integral-item">
              <BlockMath math={integral} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const GraphContent: React.FC<GraphContentProps> = ({ graphs }) => {
  const graphRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    mermaid.initialize({ 
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose'
    });

    graphs?.forEach((graph, index) => {
      if (graph.mermaidCode && graphRefs.current[index]) {
        const element = graphRefs.current[index];
        if (element) {
          element.innerHTML = `<div class="mermaid">${graph.mermaidCode}</div>`;
          const mermaidElement = element.querySelector('.mermaid') as HTMLElement;
          if (mermaidElement) {
            mermaid.init(undefined, mermaidElement);
          }
        }
      }
    });
  }, [graphs]);

  if (!graphs || graphs.length === 0) return null;

  return (
    <div className="graph-content">
      <h6>Graphs & Diagrams:</h6>
      {graphs.map((graph, index) => (
        <div key={index} className="graph-item">
          <h6>{graph.title}</h6>
          {graph.mathFunction && (
            <div className="math-function">
              Function: <InlineMath math={graph.mathFunction} />
            </div>
          )}
          {graph.domain && (
            <div className="domain-range">
              Domain: [{graph.domain[0]}, {graph.domain[1]}]
              {graph.range && `, Range: [${graph.range[0]}, ${graph.range[1]}]`}
            </div>
          )}
          {graph.mermaidCode && (
            <div 
              ref={el => { graphRefs.current[index] = el; }}
              className="mermaid-container"
            />
          )}
        </div>
      ))}
    </div>
  );
};

export const TableContent: React.FC<TableContentProps> = ({ tables }) => {
  if (!tables || tables.length === 0) return null;

  return (
    <div className="table-content">
      <h6>Tables:</h6>
      {tables.map((table, index) => (
        <div key={index} className="table-item">
          {table.caption && <div className="table-caption">{table.caption}</div>}
          <table className="data-table">
            <thead>
              <tr>
                {table.headers.map((header, headerIndex) => (
                  <th key={headerIndex}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export const DiagramContent: React.FC<DiagramContentProps> = ({ diagrams }) => {
  const diagramRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    diagrams?.forEach((diagram, index) => {
      if (diagram.mermaidCode && diagramRefs.current[index]) {
        const element = diagramRefs.current[index];
        if (element) {
          element.innerHTML = `<div class="mermaid">${diagram.mermaidCode}</div>`;
          const mermaidElement = element.querySelector('.mermaid') as HTMLElement;
          if (mermaidElement) {
            mermaid.init(undefined, mermaidElement);
          }
        }
      }
    });
  }, [diagrams]);

  if (!diagrams || diagrams.length === 0) return null;

  return (
    <div className="diagram-content">
      <h6>Diagrams:</h6>
      {diagrams.map((diagram, index) => (
        <div key={index} className="diagram-item">
          <div className="diagram-type">Type: {diagram.type}</div>
          <div className="diagram-description">{diagram.description}</div>
          {diagram.mermaidCode && (
            <div 
              ref={el => { diagramRefs.current[index] = el; }}
              className="mermaid-container"
            />
          )}
        </div>
      ))}
    </div>
  );
};
