import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// Helper function to sanitize text for database storage
function sanitizeTextForDB(text: string): string {
  if (!text) return '';
  
  // Remove null characters and other problematic control characters
  let sanitized = text.replace(/\x00/g, '');
  
  // Handle Unicode escape sequences properly
  sanitized = sanitized.replace(/\\u[0-9a-fA-F]{4}/g, (match) => {
    try {
      return String.fromCharCode(parseInt(match.slice(2), 16));
    } catch (e) {
      return ''; // Remove invalid sequences
    }
  });
  
  // Remove other problematic escape sequences
  sanitized = sanitized.replace(/\\[nrtbfav]/g, ' ');
  
  // Replace multiple whitespace with single space
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // Remove control characters that might cause database issues
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Limit length to prevent database issues
  if (sanitized.length > 50000) {
    sanitized = sanitized.substring(0, 50000) + '... (truncated)';
  }
  
  return sanitized.trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileName, extractedText, sessionId, userId } = body;
    
    if (!fileName || !extractedText) {
      return NextResponse.json({ error: 'Missing required fields: fileName, extractedText' }, { status: 400 });
    }
    
    // Sanitize the extracted text
    const sanitizedText = sanitizeTextForDB(extractedText);
    
    if (!sanitizedText) {
      return NextResponse.json({ error: 'No valid text content found after sanitization' }, { status: 400 });
    }
    
    console.log('📄 Saving resume:', {
      fileName,
      textLength: sanitizedText.length,
      sessionId,
      userId
    });
  // Handle Unicode escape sequences properly
  sanitized = sanitized.replace(/\\u[0-9a-fA-F]{4}/g, (match) => {
    try {
      console.error('Database error:', error);
      return String.fromCharCode(parseInt(match.slice(2), 16));
    } catch (e) {
      return ''; // Remove invalid sequences
    }
  });
  
  // Remove other problematic escape sequences
  sanitized = sanitized.replace(/\\[nrtbfav]/g, ' ');
  
  // Replace multiple whitespace with single space
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // Remove control characters that might cause database issues
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Limit length to prevent database issues
  if (sanitized.length > 50000) {
    sanitized = sanitized.substring(0, 50000) + '... (truncated)';
  }
  
  return sanitized.trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileName, extractedText, sessionId, userId } = body;
    
    if (!fileName || !extractedText) {
      return NextResponse.json({ error: 'Missing required fields: fileName, extractedText' }, { status: 400 });
    }
    
    // Sanitize the extracted text
    const sanitizedText = sanitizeTextForDB(extractedText);
    
    if (!sanitizedText) {
      return NextResponse.json({ error: 'No valid text content found after sanitization' }, { status: 400 });
    }
    
    console.log('📄 Saving resume:', {
      fileName,
      textLength: sanitizedText.length,
      sessionId,
      userId
    });
    
    const { error } = await supabase.from('resumes').insert({
      file_name: fileName,
      extracted_text: sanitizedText,
      session_id: sessionId || null,
      user_id: userId || null,
      uploaded_at: new Date().toISOString(),
    });
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Resume saved successfully',
      textLength: sanitizedText.length
    });
  } catch (error: any) {
    console.error('Resume save error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
}