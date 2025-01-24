import React, { useState } from 'react';

const Comments = ({ comments, onSubmit }) => {
  const [newComment, setNewComment] = useState('');

  const handleSubmit = () => {
    onSubmit(newComment);
    setNewComment('');
  };

  return (
    <div>
      <h2>Live Comments</h2>
      <div style={{ maxHeight: '150px', overflowY: 'scroll', border: '1px solid black', padding: '10px' }}>
        {comments.map((comment, index) => (
          <p key={index}>{comment}</p>
        ))}
      </div>
      <input
        type="text"
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}
        placeholder="Add a comment..."
      />
      <button onClick={handleSubmit}>Submit Comment</button>
    </div>
  );
};

export default Comments;
