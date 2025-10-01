const loadingElement = document.getElementById('loading');
const resultsContainer = document.getElementById('results-container');
const topicInput = document.getElementById('topic-input');
const fetchButton = document.getElementById('fetch-button');
const cumulativeScoreElement = document.getElementById('cumulative-score');

function formatIndianStyle(num) {
    let str = num.toString().split('').reverse().join('');
    let formatted = str.substring(0, 3);
    let rest = str.substring(3);
    if (rest) {
        formatted += ',' + rest.match(/.{1,2}/g).join(',');
    }
    return formatted.split('').reverse().join('');
}


function getSavedObscurityScore() {
    const savedScore = localStorage.getItem('total_score');
    return savedScore ? parseInt(savedScore, 10) : 0;
}

function getScoredTopics() {
    const topicsJson = localStorage.getItem('scored_topics');
    try {
        return topicsJson ? JSON.parse(topicsJson) : [];
    } catch (e) {
        console.error("Error parsing scored topics from localStorage:", e);
        return [];
    }
}

function saveObscurityScore(scoreData, topic) {
    const normalizedTopic = topic.toLowerCase().trim();
    let scoredTopics = getScoredTopics();

    if (scoredTopics.includes(normalizedTopic)) {
        console.log(`Topic "${topic}" already scored. Skipping score update.`);
        if (cumulativeScoreElement) {
            cumulativeScoreElement.textContent = getSavedObscurityScore();
        }
        return; 
    }

    let currentSearchTotalScore;

    if (typeof scoreData === 'number') {
        currentSearchTotalScore = scoreData;
    } else {
        currentSearchTotalScore = scoreData.reduce((sum, item) => sum + item.finalScore, 0);
    }
    
    if (currentSearchTotalScore === 0) {
        console.log(`Topic "${topic}" yielded zero score. Skipping storage update.`);
        return;
    }


    const previousScore = getSavedObscurityScore();
    const newCumulativeScore = previousScore + currentSearchTotalScore;

    localStorage.setItem('total_score', newCumulativeScore);
    
    scoredTopics.push(normalizedTopic);
    localStorage.setItem('scored_topics', JSON.stringify(scoredTopics));

    if (cumulativeScoreElement) {
        cumulativeScoreElement.textContent = newCumulativeScore;
    }

    console.log(`NEW topic scored: ${topic}. Score added: ${currentSearchTotalScore}. New cumulative score: ${newCumulativeScore}.`);
}

async function searchWikipedia(query) {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&namespace=0&format=json&origin=*`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    const titles = data[1]; 
    if (titles && titles.length > 0) {
        return titles[0];
    }
    return null;
}

async function fallbackSuggestions(query, articleFound = false) {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&namespace=0&format=json&origin=*`;
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    const titles = data[1];
    const descriptions = data[2];
    const links = data[3];

    let message;
    if (articleFound) {
        message = `We found the article, but its citations did not meet the <span style="color:#EAB308; font-style:bold;">OBSKI rule</span> (e.g: too short, too modern, or missing academic identifiers). You've earned 1 Obscure Point!`;
    } else {
        message = `OBSKI couldn't find a direct article for <span style="color:#EAB308;">${query}</span>. Here are related Wikipedia articles. You've earned 1 Obscure Point!`;
    }

    if (titles && titles.length > 0) {
        resultsContainer.innerHTML = `
            <div class="citation-card">
                <h3>Try these similar topics!</h3>
                <p>${message}</p>
                <ul>
                    ${titles.map((title, index) => `
                        <li><a href="${links[index]}" target="_blank" style="color:#EAB308;">${title}</a>: ${descriptions[index]}</li>
                    `).join('')}
                </ul>
            </div>
        `;
        saveObscurityScore(1, query); 
        return true;
    }
    return false;
}

async function fetchCitations() {
    const inputTopic = topicInput.value.trim();
    if (!inputTopic) {
        console.error("Please enter a topic to explore."); 
        return;
    }

    resultsContainer.innerHTML = '';
    loadingElement.classList.remove('hidden');
    let finalTopic = inputTopic;
    let success = false;
    let articleFound = false;

    try {
        const suggestedTitle = await searchWikipedia(inputTopic);

        if (!suggestedTitle) {
            if (!await fallbackSuggestions(inputTopic, false)) {
                resultsContainer.innerHTML = `<p class="error-message">❌ Error: Could not find any related Wikipedia articles for "${inputTopic}".</p>`;
            }
            return;
        }

        articleFound = true;

        if (suggestedTitle !== inputTopic) {
            console.warn(`Original search topic updated from "${inputTopic}" to the official title: "${suggestedTitle}".`);
            finalTopic = suggestedTitle;
        }
        
        const apiUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(finalTopic)}&format=json&prop=text&origin=*&continue=`;

        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();

        if (data.error || !data.parse) {
            if (!await fallbackSuggestions(inputTopic, true)) {
                resultsContainer.innerHTML = `<p class="error-message">❌ Error: The article "${finalTopic}" could not be processed.</p>`;
            }
            return;
        }

        const rawHtml = data.parse.text['*'];
        const topCitations = parseAndDisplayCitations(rawHtml, finalTopic); 
        
        if (topCitations && topCitations.length > 0) {
            saveObscurityScore(topCitations, finalTopic);
            success = true;
        } 
        
        // Final fallback if article was found (articleFound=true) but no citations met the score threshold (topCitations.length == 0)
        if (!success && articleFound) {
             if (!await fallbackSuggestions(inputTopic, true)) {
                 resultsContainer.innerHTML = `<p class="error-message">🧐 Article found but contained no scorable citations. No suggestions found either.</p>`;
             }
        }


    } catch (error) {
        resultsContainer.innerHTML = `<p class="error-message">⚠️ An unexpected network error occurred: ${error.message}</p>`;
        console.error("Fetch Error:", error);
    } finally {
        loadingElement.classList.add('hidden');
    }
}

function calculateSimilarityBonus(topic, citationText) {
    const topicWords = topic.toLowerCase().match(/\b\w+\b/g) || [];
    const citationWords = citationText.toLowerCase().match(/\b\w+\b/g) || [];
    
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'in', 'on', 'of', 'for', 'is', 'to', 'was', 'with']);

    const significantTopicWords = topicWords.filter(w => w.length > 2 && !stopWords.has(w));

    if (significantTopicWords.length === 0) {
        return 1;
    }
    
    let matchCount = 0;
    
    for (const topicWord of significantTopicWords) {
        const wordRegex = new RegExp('\\b' + topicWord + '\\b', 'i');
        if (citationText.search(wordRegex) !== -1) {
            matchCount++;
        }
    }
    
    const matchRatio = matchCount / significantTopicWords.length;
    
    const baseBonus = 1;
    const maxMatchBonus = 19;
    
    return Math.floor(baseBonus + (maxMatchBonus * matchRatio));
}


function parseAndDisplayCitations(rawHtml, topic) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');

    const referencesList = doc.querySelector('.reflist, .references');

    if (!referencesList) {
        return []; 
    }

    const citations = referencesList.querySelectorAll('li');
    let citationData = [];

    citations.forEach(li => {
        let text = li.textContent.replace(/^\[.*?\]\s*/, '').trim();

        if (text.length > 50) { 
            const obscurityScore = calculateObscurityScore(text);
            
            const similarityBonus = calculateSimilarityBonus(topic, text);
            
            const finalScore = obscurityScore + similarityBonus;
            
            citationData.push({
                text: text,
                obscurityScore: obscurityScore,
                similarityBonus: similarityBonus,
                finalScore: finalScore,
                html: li.innerHTML 
            });
        }
    });

    citationData.sort((a, b) => b.finalScore - a.finalScore);

    const topCitations = citationData.slice(0, 10);
    renderResults(topCitations);
    
    return topCitations; 
}

function calculateObscurityScore(text) {
    let score = 0;
    
    score += Math.min(text.length / 5, 50); 

    const nicheKeywords = [
        'monograph', 'dissertation', 'proceedings', 'archival', 
        'ephemera', 'quarterly', 'vol.', 'ibid', 'op. cit.', 
        'journal of', 'university press', 'hdl:', 'doi:'
    ];
    nicheKeywords.forEach(keyword => {
        if (text.toLowerCase().includes(keyword)) {
            score += 15;
        }
    });

    const yearMatches = text.match(/\b(18|19)\d{2}\b/g); 
    if (yearMatches) {
        score += yearMatches.length * 10;
    }

    if (text.includes('ASIN') || text.includes('JSTOR') || text.includes('OCLC') || text.includes('ISBN') || text.includes('SSRN')) {
        score += 5;
    }
    
    return Math.floor(score);
}

function renderResults(citations) {
    if (citations.length === 0) {
        resultsContainer.innerHTML = '<p>🧐 No suitably long or obscure citations were found for this topic.</p>';
        return;
    }

    resultsContainer.innerHTML = citations.map(item => `
        <div class="citation-card ${item.finalScore > 70 ? 'obscure' : ''}">
            <h3>
                Final Obscurity Score: ${item.finalScore} <span role="img" aria-label="Book emoji">📚</span>
                <span style="font-size: 0.8em; opacity: 0.7;">
                    (Rarity: ${item.obscurityScore} + Similarity Bonus: ${item.similarityBonus})
                </span>
            </h3>
            <p>
                <strong>Clean Text:</strong> ${item.text}
            </p>
            <details>
                <summary>Original HTML and Hyperlinks</summary>
                <div class="original-html">${item.html}</div>
            </details>
        </div>
    `).join('');
    set_score();
}

function initializeApp() {
    if (cumulativeScoreElement) {
        cumulativeScoreElement.textContent = getSavedObscurityScore();
    }

    const exploreButton = document.querySelector('.expl'); 

    if (exploreButton) {
        exploreButton.addEventListener('click', fetchCitations);
        
        topicInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                fetchCitations();
            }
        });
    } else {
        const legacyFetchButton = document.getElementById('fetch-button');
        if(legacyFetchButton) {
            legacyFetchButton.addEventListener('click', fetchCitations);
        } else {
            console.error("Initialization Error: Could not find the 'Explore' button."); 
        }
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);

function loaded() {
    set_score();
}
function set_score() {
    points_spn = document.getElementById("points");
    points_local = localStorage.getItem("total_score");

    const rawScore = parseInt(points_local) || 0;
    const formattedScore = formatIndianStyle(rawScore);

    points_spn.innerHTML = formattedScore; 
}

function resetPoints() {
    if (window.confirm("Are you sure you want to reset your Obscure Points? This action cannot be undone.")) {
        localStorage.removeItem('total_score');
        localStorage.removeItem('scored_topics');
        set_score();
        window.alert("Your Obscure Points have been reset.");
    }
}
