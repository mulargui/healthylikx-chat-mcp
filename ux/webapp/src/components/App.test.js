import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import Chat from './Chat';

jest.mock('axios');

describe('Chat Component Unit Tests', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock the fetch for lambda URL
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ LAMBDA_FUNCTION_URL: 'https://mock-lambda-url.com' }),
      })
    );
  });
  
  afterAll(() => {
    // Clear all mocks after all tests
    jest.clearAllMocks();
  });

  test('Simple question and response', async () => {
    const QUESTION = 'What is the capital of France?';
    const ANSWER = 'Paris is the capital of France.';

    axios.post.mockResolvedValueOnce({
      data: { answer: ANSWER }
    });

    render(<Chat />);

    const messagesContainer = screen.getByTestId('messages-container');
    const inputContainer = screen.getByTestId('input-container');

    // Wait for the components to load
    await waitFor(() => {
      expect(messagesContainer).toBeInTheDocument();
      expect(inputContainer).toBeInTheDocument();
    });

    // Type a question and submit
    fireEvent.change(inputContainer, { target: { value: QUESTION }});
    fireEvent.click(screen.getByText('Send'));

    // Wait for and check the response
    await waitFor(() => {
      expect(screen.getByText(QUESTION)).toBeInTheDocument();
      expect(screen.getByText(ANSWER)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId('message-0')).toHaveTextContent(QUESTION);
      expect(screen.getByTestId('message-1')).toHaveTextContent(ANSWER);    
    });
  });

  test('Multi-turn conversation', async () => {
    const QUESTION1 = 'What is the capital of France?';
    const ANSWER1 = 'The sky appears blue due to a phenomenon called Rayleigh scattering.';
    const QUESTION2 = 'What is the capital of France?';
    const ANSWER2 = 'Rayleigh scattering occurs when sunlight interacts with the gases in Earth\'s atmosphere.';
 
    axios.post
      .mockResolvedValueOnce({
        data: { answer:  ANSWER1}
      })
      .mockResolvedValueOnce({
        data: { answer: ANSWER2 }
      });

    render(<Chat />);

    const messagesContainer = screen.getByTestId('messages-container');
    const inputContainer = screen.getByTestId('input-container');

    // Wait for the components to load
    await waitFor(() => {
      expect(messagesContainer).toBeInTheDocument();
      expect(inputContainer).toBeInTheDocument();
    });

    // First question
    fireEvent.change(inputContainer, { target: { value: QUESTION1 }});
    fireEvent.click(screen.getByText('Send'));

    // Wait for and check the first response
    await waitFor(() => {
      expect(screen.getByTestId('message-0')).toHaveTextContent(QUESTION1);
      expect(screen.getByTestId('message-1')).toHaveTextContent(ANSWER1);    
    });

    // Second question
    fireEvent.change(inputContainer, { target: { value: QUESTION2 }});
    fireEvent.click(screen.getByText('Send'));

    // Wait for and check the second response
    await waitFor(() => {
      expect(screen.getByTestId('message-2')).toHaveTextContent(QUESTION2);
      expect(screen.getByTestId('message-3')).toHaveTextContent(ANSWER2);    
    });
  });

  test('Handling special characters and Unicode', async () => {
    const QUESTION = 'How do you say "Hello" in Japanese? (日本語)';
    const ANSWER = 'こんにちは (Konnichiwa) means "Hello" in Japanese.';

    axios.post.mockResolvedValueOnce({
      data: { answer: ANSWER }
    });

    render(<Chat />);

    const messagesContainer = screen.getByTestId('messages-container');
    const inputContainer = screen.getByTestId('input-container');

    // Wait for the components to load
    await waitFor(() => {
      expect(messagesContainer).toBeInTheDocument();
      expect(inputContainer).toBeInTheDocument();
    });

    // Type a question and submit
    fireEvent.change(inputContainer, { target: { value: QUESTION }});
    fireEvent.click(screen.getByText('Send'));

    // Wait for and check the response
    await waitFor(() => {
      expect(screen.getByTestId('message-0')).toHaveTextContent(QUESTION);
      expect(screen.getByTestId('message-1')).toHaveTextContent(ANSWER);    
    });
  });

  test('Clear chat functionality', async () => {
    const QUESTION = 'Test question';
    const ANSWER = 'Test response';

    axios.post.mockResolvedValueOnce({
      data: { answer: ANSWER }
    });

    render(<Chat />);

    const messagesContainer = screen.getByTestId('messages-container');
    const inputContainer = screen.getByTestId('input-container');

    // Wait for the components to load
    await waitFor(() => {
      expect(messagesContainer).toBeInTheDocument();
      expect(inputContainer).toBeInTheDocument();
    });

    // Type a question and submit
    fireEvent.change(inputContainer, { target: { value: QUESTION }});
    fireEvent.click(screen.getByText('Send'));

    // Wait for and check the response
    await waitFor(() => {
      expect(screen.getByTestId('message-0')).toHaveTextContent(QUESTION);
      expect(screen.getByTestId('message-1')).toHaveTextContent(ANSWER);    
    });

    // Clear the chat
    fireEvent.click(screen.getByText('Clear'));

    // Check that the messages are cleared
    expect(screen.queryByText(QUESTION)).not.toBeInTheDocument();
    expect(screen.queryByText(ANSWER)).not.toBeInTheDocument();
  });

  test('Error handling', async () => {
    const QUESTION = 'Test question';
    const ANSWER = 'Error: Unable to get response';

    axios.post.mockRejectedValueOnce(new Error('API Error'));

    render(<Chat />);

    const messagesContainer = screen.getByTestId('messages-container');
    const inputContainer = screen.getByTestId('input-container');

    // Wait for the components to load
    await waitFor(() => {
      expect(messagesContainer).toBeInTheDocument();
      expect(inputContainer).toBeInTheDocument();
    });

    // Type a question and submit
    fireEvent.change(inputContainer, { target: { value: QUESTION }});
    fireEvent.click(screen.getByText('Send'));

    // Wait for and check the error message
    await waitFor(() => {
      expect(screen.getByTestId('message-0')).toHaveTextContent(QUESTION);
      expect(screen.getByTestId('message-1')).toHaveTextContent(ANSWER);    
    });
  });
});
