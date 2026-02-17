'use client';

import { useMemo, useState, useEffect } from 'react';
import type { CoChangeGraph } from '@/lib/git/types';
import './FileOccurrenceTable.css';

interface FileData {
  filename: string;
  occurrences: number;
}

interface FileOccurrenceTableProps {
  graphData: CoChangeGraph | null;
}

export default function FileOccurrenceTable({ graphData }: FileOccurrenceTableProps) {
  const [csvData, setCsvData] = useState<FileData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load CSV data on mount
  useEffect(() => {
    const loadCSV = async () => {
      try {
        const response = await fetch('/components/df.csv');
        const text = await response.text();
        
        // Parse CSV
        const lines = text.trim().split('\n');
        const data: FileData[] = [];
        
        // Skip header row
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;
          
          // Find the last comma to split filename and occurrences
          const lastCommaIndex = line.lastIndexOf(',');
          const filename = line.substring(0, lastCommaIndex);
          const occurrences = parseInt(line.substring(lastCommaIndex + 1), 10);
          
          if (!isNaN(occurrences)) {
            data.push({ filename, occurrences });
          }
        }
        
        setCsvData(data);
      } catch (error) {
        console.error('Failed to load CSV:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCSV();
  }, []);

  const sortedFiles = useMemo(() => {
    // Use CSV data if available, otherwise fall back to graphData
    if (csvData.length > 0) {
      return csvData;
    }
    
    if (!graphData?.nodes) return [];
    
    return graphData.nodes
      .map((node) => ({
        filename: node.id,
        occurrences: node.radius,
      }))
      .sort((a, b) => b.occurrences - a.occurrences);
  }, [csvData, graphData]);

  if (isLoading || sortedFiles.length === 0) {
    return null;
  }

  // Find max occurrences for gradient calculation
  const maxOccurrences = Math.max(...sortedFiles.map((f) => f.occurrences));

  // Calculate opacity: higher occurrences = more opaque red
  const getOpacity = (occurrences: number) => {
    return Math.max(0.1, (occurrences / maxOccurrences) * 0.6);
  };

  return (
    <div className="file-occurrence-container">
      <div className="file-occurrence-header">
        <h2>Total unique filenames: {sortedFiles.length}</h2>
      </div>
      
      <div className="file-occurrence-table-wrapper">
        <table className="file-occurrence-table">
          <thead>
            <tr>
              <th>Filename</th>
              <th className="occurrence-column"># of Occurrences</th>
            </tr>
          </thead>
          <tbody>
            {sortedFiles.map((file, index) => (
              <tr
                key={index}
                style={{
                  backgroundColor: `rgba(255, 0, 0, ${getOpacity(file.occurrences)})`,
                }}
                className="file-row"
              >
                <td className="filename-cell">{file.filename}</td>
                <td className="occurrence-cell">{file.occurrences}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
