import axios from 'axios';

const API_BASE_URL = 'http://localhost:8001';

export const api = {
  scanUrl: async (url, wcagLevel = 'AA') => {
    try {
      const response = await axios.post(`${API_BASE_URL}/scan`, { url, wcag_level: wcagLevel });
      return response.data;
    } catch (error) {
      console.error('Scan API Error:', error);
      throw error;
    }
  },
  getHistory: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/history`);
      return response.data;
    } catch (error) {
      console.error('History API Error:', error);
      throw error;
    }
  },
  remediate: async (selectedIssues, userQuery, history = [], context = null) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/remediate`, {
        selected_issues: selectedIssues,
        user_query: userQuery,
        history,
        context
      });
      return response.data;
    } catch (error) {
      console.error('Remediate API Error:', error);
      throw error;
    }
  },
  createGithubIssue: async (token, repoUrl, title, body) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/github/issue`, {
        token, repo_url: repoUrl, title, body
      });
      return response.data;
    } catch (error) {
      console.error('GitHub Issue Error:', error);
      throw error;
    }
  },
  createGithubPR: async (token, repoUrl, branch, title, body, changes) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/github/pr`, {
        token, repo_url: repoUrl, branch, title, body, changes
      });
      return response.data;
    } catch (error) {
      console.error('GitHub PR Error:', error);
      throw error;
    }
  },
  analyzeRepo: async (token, repoUrl) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/github/analyze`, { token, repo_url: repoUrl });
      return response.data;
    } catch (error) {
      console.error('Analyze Repo Error:', error);
      throw error;
    }
  },
  searchCode: async (token, repoUrl, wcagId, htmlSnippet) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/github/search-code`, {
        token, repo_url: repoUrl, wcag_id: wcagId, html_snippet: htmlSnippet
      });
      return response.data;
    } catch (error) {
      console.error('Search Code Error:', error);
      throw error;
    }
  }
};
