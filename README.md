<h1>OBSKI</h1> <br>
The Obscure Wikipedia Citation Explorer
Slogan: Find the sources no one else sees.

OBSKI is a dynamic web application designed to help researchers and curious minds dive deep into niche academic sources cited within Wikipedia articles. It analyzes citations to assign a unique Obscurity Score, quantifying how rare and relevant a source is likely to be.

✨ Features
Obscurity Scoring: Citations are analyzed and ranked based on factors like length, age (pre-2000 publication), and the presence of niche academic keywords (monographs, DOIs, dissertations).

Similarity Bonus: The total score rewards the user more if the rare citation contains words that highly overlap with the original search topic, confirming its relevance (scoring minimum 1 point, up to 20 points for high relevance).

Cumulative Points Tracking: Users earn "Obscure Points" for finding new topics, which persist across sessions using localStorage. Scoring is protected against duplicate searches.

Point Reset: Users can click the 'X' button to reset their total score and clear their search history.

<ul>
<h2>⚙️ How It Works</h2>
<li>Input: The user enters a topic (e.g., "Medieval music").</li>

<li>API Fetch & Parsing: The application fetches the content of the corresponding English Wikipedia article via the MediaWiki API, focusing on the "References" section.</li>

<li>Scoring Logic: Each citation is processed to calculate:
Rarity Score: Measures obscurity based on academic structure and age.
Similarity Bonus: Measures relevance based on keyword overlap with the search query.</li>

<li>Persistence: If the search is new, the total score from the top 10 results is added to the user's cumulative points.</li>
</ol>
<br><br><br>
GO NICHE DIVE
