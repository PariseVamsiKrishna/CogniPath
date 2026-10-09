import sqlite3
import json
from datetime import datetime, timezone

conn = sqlite3.connect('backend/cognipath.db')
c = conn.cursor()

now_str = datetime.now(timezone.utc).isoformat()

# -------------------------------------------------------------
# 1. FIX CS101 (Course 1) EXAM LINKING
# -------------------------------------------------------------
# Link Module 1 to Exam 1
c.execute("UPDATE modules SET module_exam_id = 1, has_module_exam = 1 WHERE id = 1 AND course_id = 1")

# Create Exam for Module 2 if not exists
c.execute("SELECT id FROM exams WHERE course_id = 1 AND module_id = 2")
m2_exam = c.fetchone()
if not m2_exam:
    c.execute("""
        INSERT INTO exams (course_id, module_id, exam_type, scope, title, time_limit_mins, passing_score, created_by, created_at)
        VALUES (1, 2, 'MODULE_QUIZ', 'MODULE_END', 'Module 2: Tree Rotations & Balance Mastery Quiz', 15, 60.0, 1, ?)
    """, (now_str,))
    m2_exam_id = c.lastrowid
    # Add questions for Module 2 Exam
    eqs = [
        ("MCQ", "What is the primary condition that triggers an AVL tree rotation?",
         json.dumps(["Balance factor becomes greater than +1 or less than -1", "Node has more than two children", "Tree height exceeds 10", "Leaf node is deleted"]),
         "0", "An AVL tree strictly preserves balance factors in {-1, 0, +1}.", "CS101 Module 2 Notes", 1),
        ("MCQ", "Which rotation sequence resolves a Left-Right (LR) imbalance?",
         json.dumps(["Left rotation on child, then Right rotation on parent", "Single Right rotation", "Single Left rotation", "Double Right rotation"]),
         "0", "An LR imbalance requires a left rotation on the left child followed by a right rotation on the parent.", "CS101 Module 2 Notes", 2),
        ("MCQ", "What is the worst-case asymptotic search complexity in a Red-Black Tree?",
         json.dumps(["O(log N)", "O(N)", "O(1)", "O(N^2)"]),
         "0", "Red-black trees guarantee strict O(log N) operations by preserving black height invariants.", "CS101 Module 2 Notes", 3)
    ]
    for q_type, q_text, opts, ans, expl, src, ord_idx in eqs:
        c.execute("""
            INSERT INTO exam_questions (exam_id, question_type, question_text, options, correct_answer, explanation, source_ref, order_index)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (m2_exam_id, q_type, q_text, opts, ans, expl, src, ord_idx))
    
    c.execute("UPDATE modules SET module_exam_id = ?, has_module_exam = 1 WHERE id = 2 AND course_id = 1", (m2_exam_id,))

# Ensure CS101 Final Exam has questions
c.execute("SELECT id FROM exams WHERE course_id = 1 AND exam_type = 'FINAL_EXAM'")
final_exam_row = c.fetchone()
if final_exam_row:
    final_id = final_exam_row[0]
    c.execute("SELECT COUNT(*) FROM exam_questions WHERE exam_id = ?", (final_id,))
    if c.fetchone()[0] == 0:
        fqs = [
            ("MCQ", "What tree rotation is performed to rebalance an AVL node with a Left-Left (LL) insertion imbalance?",
             json.dumps(["Single Right (Clockwise) Rotation", "Single Left (Counter-Clockwise) Rotation", "Left-Right Double Rotation", "Right-Left Double Rotation"]),
             "0", "A single right rotation restores balance.", "CS101 Final Exam", 1),
            ("MCQ", "What is the maximum allowed balance factor |height(left) - height(right)| in an AVL tree?",
             json.dumps(["1", "0", "2", "3"]),
             "0", "Balance factors must remain in {-1, 0, +1}.", "CS101 Final Exam", 2),
            ("MCQ", "In-order traversal of a binary tree visits nodes in which recursive order?",
             json.dumps(["Left Subtree -> Root -> Right Subtree", "Root -> Left Subtree -> Right Subtree", "Right Subtree -> Root -> Left Subtree", "Root -> Right Subtree -> Left Subtree"]),
             "0", "In-order visits Left, Root, Right.", "CS101 Final Exam", 3),
            ("MCQ", "Why do self-balancing trees outperform basic BSTs in production systems?",
             json.dumps(["They guarantee O(log N) worst-case lookup by controlling tree height", "They allocate zero memory", "They store keys contiguously", "They run hashing"]),
             "0", "Dynamic balancing prevents tree skewing.", "CS101 Final Exam", 4),
            ("MCQ", "Which data structure provides the optimal helper buffer for Breadth-First Level-Order traversal?",
             json.dumps(["FIFO Queue", "LIFO Stack", "Max-Heap Priority Queue", "Hash Map"]),
             "0", "A FIFO queue guarantees nodes are explored level by level.", "CS101 Final Exam", 5)
        ]
        for q_type, q_text, opts, ans, expl, src, ord_idx in fqs:
            c.execute("""
                INSERT INTO exam_questions (exam_id, question_type, question_text, options, correct_answer, explanation, source_ref, order_index)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (final_id, q_type, q_text, opts, ans, expl, src, ord_idx))

# -------------------------------------------------------------
# 2. SEED MODULES, TOPICS, RESOURCES & EXAMS FOR AI201 (Course 2)
# -------------------------------------------------------------
c.execute("SELECT id FROM courses WHERE id = 2 OR code = 'AI201'")
course_2 = c.fetchone()
if course_2:
    c2_id = course_2[0]

    # Check if Module 1 exists for Course 2
    c.execute("SELECT id FROM modules WHERE course_id = ?", (c2_id,))
    existing_c2_mods = c.fetchall()
    
    if not existing_c2_mods:
        # Module 1
        c.execute("""
            INSERT INTO modules (course_id, title, description, order_index, has_module_exam, created_at)
            VALUES (?, 'Module 1: Foundations of Deep Learning & Backpropagation',
                    'Master multi-layer perceptrons, non-linear activation functions, cost surfaces, and the calculus of backpropagation.',
                    1, 1, ?)
        """, (c2_id, now_str))
        c2_mod1_id = c.lastrowid

        # Topics for Module 1
        c2_topics_m1 = [
            (c2_mod1_id, "Perceptrons, Multi-Layer Feedforward Networks & Activations",
             "Explore artificial neurons, sigmoid/ReLU activation functions, and universal approximation theorems.",
             "https://www.youtube.com/watch?v=aircAruvnKk", "aircAruvnKk", 1),
            (c2_mod1_id, "Gradient Descent & The Mathematics of Backpropagation",
             "Step-by-step calculus derivation of chain rule gradients propagating error through hidden weight layers.",
             "https://www.youtube.com/watch?v=IHZwWFHWa-w", "IHZwWFHWa-w", 2)
        ]
        for mid, title, desc, y_url, y_id, ord_idx in c2_topics_m1:
            c.execute("""
                INSERT INTO topics (module_id, title, description, youtube_url, youtube_video_id, order_index, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (mid, title, desc, y_url, y_id, ord_idx, now_str))

        # Resource for Module 1 (PDF)
        c.execute("""
            INSERT INTO module_resources (module_id, title, file_url, file_type, is_view_only, chunk_count, created_at)
            VALUES (?, 'AI201 Lecture 01: Neural Networks & Backprop Reference Notes',
                    '/uploads/CS101_Lecture_04_Trees_and_BST.pdf', 'pdf', 1, 3, ?)
        """, (c2_mod1_id, now_str))

        # Module 1 Exam for Course 2
        c.execute("""
            INSERT INTO exams (course_id, module_id, exam_type, scope, title, time_limit_mins, passing_score, created_by, created_at)
            VALUES (?, ?, 'MODULE_QUIZ', 'MODULE_END', 'Module 1: Neural Networks & Backprop Mastery Quiz', 15, 60.0, 1, ?)
        """, (c2_id, c2_mod1_id, now_str))
        c2_m1_exam_id = c.lastrowid
        c.execute("UPDATE modules SET module_exam_id = ? WHERE id = ?", (c2_m1_exam_id, c2_mod1_id))

        m1_ai_qs = [
            ("MCQ", "Why are non-linear activation functions (like ReLU or Sigmoid) essential in deep neural networks?",
             json.dumps(["Without non-linearity, multi-layer networks collapse mathematically into a single linear transformation", "They reduce memory consumption to zero", "They eliminate the need for weights", "They guarantee 100% training accuracy"]),
             "0", "A composition of linear functions is just another linear function. Non-linearities enable universal approximation of arbitrary functions.", "AI201 Module 1, Lecture 1", 1),
            ("MCQ", "What mathematical rule underpins the backpropagation algorithm?",
             json.dumps(["The Chain Rule of Calculus", "Bayes Theorem", "L'Hopital's Rule", "Euclidean Distance Metric"]),
             "0", "Backpropagation computes partial derivatives of the loss with respect to weights using the chain rule.", "AI201 Module 1, Lecture 2", 2),
            ("MCQ", "What problem in deep networks does the Rectified Linear Unit (ReLU) activation primarily help mitigate?",
             json.dumps(["Vanishing Gradient Problem in positive regimes", "Exploding Memory Allocation", "Matrix Inversion Divergence", "Overfitting on small datasets"]),
             "0", "ReLU has a constant derivative of 1 for positive inputs, preventing gradients from vanishing exponentially.", "AI201 Module 1, Lecture 1", 3)
        ]
        for q_type, q_text, opts, ans, expl, src, ord_idx in m1_ai_qs:
            c.execute("""
                INSERT INTO exam_questions (exam_id, question_type, question_text, options, correct_answer, explanation, source_ref, order_index)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (c2_m1_exam_id, q_type, q_text, opts, ans, expl, src, ord_idx))

        # Module 2 for Course 2
        c.execute("""
            INSERT INTO modules (course_id, title, description, order_index, has_module_exam, created_at)
            VALUES (?, 'Module 2: Sequence Models & Transformer Attention Mechanisms',
                    'Explore Recurrent Neural Networks, LSTMs, Scaled Dot-Product Self-Attention, and Transformer architectures.',
                    2, 1, ?)
        """, (c2_id, now_str))
        c2_mod2_id = c.lastrowid

        # Topics for Module 2
        c2_topics_m2 = [
            (c2_mod2_id, "Recurrent Neural Networks, LSTMs & Vanishing Gradients",
             "Understand sequential data modeling, hidden state recurrence, and gating units (forget, input, output).",
             "https://www.youtube.com/watch?v=LHXXI4-IEns", "LHXXI4-IEns", 1),
            (c2_mod2_id, "Transformer Self-Attention & Query-Key-Value Mechanics",
             "Demystify the Attention(Q, K, V) = softmax(QK^T / sqrt(d_k))V equation and multi-head parallel attention projections.",
             "https://www.youtube.com/watch?v=wjZofJX0v4U", "wjZofJX0v4U", 2)
        ]
        for mid, title, desc, y_url, y_id, ord_idx in c2_topics_m2:
            c.execute("""
                INSERT INTO topics (module_id, title, description, youtube_url, youtube_video_id, order_index, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (mid, title, desc, y_url, y_id, ord_idx, now_str))

        # Resource for Module 2 (PDF)
        c.execute("""
            INSERT INTO module_resources (module_id, title, file_url, file_type, is_view_only, chunk_count, created_at)
            VALUES (?, 'AI201 Lecture 02: Transformer Attention Architecture Notes',
                    '/uploads/CS101_Lecture_04_Trees_and_BST.pdf', 'pdf', 1, 3, ?)
        """, (c2_mod2_id, now_str))

        # Module 2 Exam for Course 2
        c.execute("""
            INSERT INTO exams (course_id, module_id, exam_type, scope, title, time_limit_mins, passing_score, created_by, created_at)
            VALUES (?, ?, 'MODULE_QUIZ', 'MODULE_END', 'Module 2: Attention & Transformers Mastery Quiz', 15, 60.0, 1, ?)
        """, (c2_id, c2_mod2_id, now_str))
        c2_m2_exam_id = c.lastrowid
        c.execute("UPDATE modules SET module_exam_id = ? WHERE id = ?", (c2_m2_exam_id, c2_mod2_id))

        m2_ai_qs = [
            ("MCQ", "In the Scaled Dot-Product Attention formula Attention(Q,K,V) = softmax(QK^T / sqrt(d_k))V, what purpose does sqrt(d_k) scaling serve?",
             json.dumps(["Prevents dot products from growing excessively large and pushing the softmax into regions with vanishingly small gradients", "Normalizes the output tensor to zero mean", "Doubles the sequence length capacity", "Eliminates need for value projection"]),
             "0", "For large projection dimensions d_k, dot products grow large, causing softmax gradients to become dangerously small. Dividing by sqrt(d_k) stabilizes training.", "AI201 Module 2, Attention", 1),
            ("MCQ", "What is the primary computational advantage of Transformers over standard Recurrent Neural Networks (RNNs)?",
             json.dumps(["Full parallelization across sequence tokens during training", "Zero matrix multiplications", "Inherent recurrence without positional encodings", "Fixed constant parameter count for any vocabulary size"]),
             "0", "Self-attention processes all sequence positions simultaneously rather than sequentially step-by-step.", "AI201 Module 2, Transformers", 2),
            ("MCQ", "Why do Transformers require Positional Encodings?",
             json.dumps(["Because self-attention is permutation-invariant and has no inherent sense of token order", "To reduce training loss to exactly zero", "To compress sequence length", "To encrypt inputs"]),
             "0", "Self-attention computes token similarity without order awareness. Positional encodings inject sequence order information.", "AI201 Module 2, Encodings", 3)
        ]
        for q_type, q_text, opts, ans, expl, src, ord_idx in m2_ai_qs:
            c.execute("""
                INSERT INTO exam_questions (exam_id, question_type, question_text, options, correct_answer, explanation, source_ref, order_index)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (c2_m2_exam_id, q_type, q_text, opts, ans, expl, src, ord_idx))

        # Final Certification Exam for Course 2
        c.execute("""
            INSERT INTO exams (course_id, module_id, exam_type, scope, title, time_limit_mins, passing_score, created_by, created_at)
            VALUES (?, NULL, 'FINAL_EXAM', 'FINAL_COURSE', 'AI201: Comprehensive Deep Learning & Attention Certification Exam', 30, 70.0, 1, ?)
        """, (c2_id, now_str))
        c2_final_id = c.lastrowid

        c2_final_qs = [
            ("MCQ", "What is the role of Keys (K), Queries (Q), and Values (V) in Multi-Head Self-Attention?",
             json.dumps(["Queries match with Keys to compute relevance weights that are used to average the Values", "Queries represent outputs, Keys are loss functions, Values are gradients", "Keys and Queries are identical linear constants that filter the dataset", "Values are discarded after computing Query dot products"]),
             "0", "Queries query the Keys to determine an attention score distribution, which weights the linear combination of Values.", "AI201 Final Exam", 1),
            ("MCQ", "Which optimization algorithm adapts learning rates individually for each parameter using first and second gradient moments?",
             json.dumps(["Adam (Adaptive Moment Estimation)", "Vanilla Stochastic Gradient Descent (SGD)", "Linear Regression", "Bubble Sort"]),
             "0", "Adam computes adaptive learning rates using exponential moving averages of gradients and squared gradients.", "AI201 Final Exam", 2),
            ("MCQ", "What is the primary function of Layer Normalization in Transformer blocks?",
             json.dumps(["Stabilizes activations across feature dimensions, facilitating smoother optimization and gradient flow", "Reduces parameter size by 50%", "Replaces the attention mechanism", "Eliminates all negative numbers"]),
             "0", "LayerNorm normalizes inputs across the hidden dimension per token, stabilizing deep Transformer training.", "AI201 Final Exam", 3),
            ("MCQ", "In an LSTM cell, which gate decides what information to discard from the cell state?",
             json.dumps(["Forget Gate", "Input Gate", "Output Gate", "Modulation Gate"]),
             "0", "The forget gate applies a sigmoid layer to decide which historical memories to drop from the cell state.", "AI201 Final Exam", 4),
            ("MCQ", "Why does Cross-Entropy loss work well with Softmax output layers for multi-class classification?",
             json.dumps(["Its gradient simplifies cleanly to (p - y), avoiding saturation slowdowns when errors are large", "It only outputs integers", "It guarantees zero training time", "It eliminates backpropagation"]),
             "0", "The derivative of cross-entropy combined with softmax yields linear error term (predicted - ground_truth).", "AI201 Final Exam", 5)
        ]
        for q_type, q_text, opts, ans, expl, src, ord_idx in c2_final_qs:
            c.execute("""
                INSERT INTO exam_questions (exam_id, question_type, question_text, options, correct_answer, explanation, source_ref, order_index)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (c2_final_id, q_type, q_text, opts, ans, expl, src, ord_idx))

conn.commit()
print("DATABASE POPULATION COMPLETED SUCCESSFULLY!")

# Verification summary
print("\n=== UPDATED VERIFICATION ===")
for row in c.execute("SELECT id, course_id, title, module_exam_id FROM modules").fetchall():
    print(f"Module {row[0]} in Course {row[1]}: '{row[2]}' | Exam ID: {row[3]}")

for row in c.execute("SELECT id, module_id, title, youtube_video_id FROM topics").fetchall():
    print(f"Topic {row[0]} (Module {row[1]}): '{row[2]}' | YouTube ID: {row[3]}")

for row in c.execute("SELECT id, module_id, title, file_url FROM module_resources").fetchall():
    print(f"Resource {row[0]} (Module {row[1]}): '{row[2]}' | URL: {row[3]}")

for row in c.execute("SELECT id, course_id, module_id, exam_type, title FROM exams").fetchall():
    print(f"Exam {row[0]} (Course {row[1]}, Module {row[2]}): [{row[3]}] '{row[4]}'")

conn.close()
