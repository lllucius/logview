import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders LogView title', () => {
  render(<App />);
  const titleElement = screen.getByText(/LogView/i);
  expect(titleElement).toBeInTheDocument();
});
