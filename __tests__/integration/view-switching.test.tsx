import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../../app/page';

// Mock the fetch API
global.fetch = jest.fn();

describe('View Switching Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        success: true,
        data: {
          name: 'src',
          path: 'src',
          value: 15,
          isFile: false,
          children: [
            {
              name: 'file1.js',
              path: 'src/file1.js',
              value: 10,
              isFile: true,
              fileData: {
                filePath: 'src/file1.js',
                totalCommitCount: 10,
                recentCommitCount: 10,
                frequencyScore: 1.0,
              },
            },
          ],
        },
        metadata: {
          totalFilesAnalyzed: 1,
          filesDisplayed: 1,
          totalCommits: 10,
          analysisDurationMs: 100,
          timeRange: '2w',
        },
      }),
    });
  });

  it('can switch between heatmap and activity graph views', async () => {
    render(<Home />);

    // Select repository and analyze
    const repoInput = screen.getByPlaceholderText('/path/to/your/git/repository');
    fireEvent.change(repoInput, { target: { value: '/test/repo' } });
    
    const analyzeButton = screen.getByRole('button', { name: /analyze repository/i });
    fireEvent.click(analyzeButton);

    // Wait for heatmap to load
    await waitFor(() => {
      expect(screen.getByText('Activity Level')).toBeInTheDocument();
    });

    // Switch to activity graph
    const activityGraphButton = screen.getByLabelText('Activity Graph view');
    fireEvent.click(activityGraphButton);

    // Should show activity graph
    await waitFor(() => {
      expect(screen.getByText('File Types')).toBeInTheDocument();
    });
  });
});