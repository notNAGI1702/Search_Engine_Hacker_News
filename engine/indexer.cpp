#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <unordered_map>
#include <algorithm>
#include <cctype>
#include <nlohmann/json.hpp>

using json = nlohmann::json;
using namespace std;

// Splits on all non-alphanumeric characters, normalizes to lowercase
vector<string> tokenize(const string &text)
{
    vector<string> tokens;
    string current;
    for (char c : text)
    {
        if (isalnum(static_cast<unsigned char>(c)))
        {
            current += tolower(static_cast<unsigned char>(c));
        }
        else
        {
            if (!current.empty())
            {
                tokens.push_back(current);
                current.clear();
            }
        }
    }
    if (!current.empty())
    {
        tokens.push_back(current);
    }
    return tokens;
}

int main()
{
    string corpusPath = "../data/hn_corpus.json";
    string indexPath = "../data/inverted_index.json";

    cout << "Loading corpus from: " << corpusPath << endl;
    ifstream corpusFile(corpusPath);
    if (!corpusFile.is_open())
    {
        cerr << "Error: Could not open corpus file: " << corpusPath << endl;
        cerr << "Ensure exportCorpus.js has been run first." << endl;
        return 1;
    }

    json corpusJson;
    try
    {
        corpusFile >> corpusJson;
    }
    catch (const exception &e)
    {
        cerr << "Error parsing corpus JSON: " << e.what() << endl;
        return 1;
    }
    corpusFile.close();

    if (!corpusJson.is_array())
    {
        cerr << "Error: Corpus JSON is not an array." << endl;
        return 1;
    }

    cout << "Parsing " << corpusJson.size() << " documents..." << endl;

    double totalDocLen = 0;
    int docCount = 0;
    unordered_map<int, int> docLengths;
    // inverted_index maps: term -> list of postings {doc_id, tf}
    unordered_map<string, vector<pair<int, int>>> invertedIndex;

    for (const auto &doc : corpusJson)
    {
        if (!doc.contains("id") || !doc["id"].is_number_integer())
        {
            continue;
        }
        int docId = doc["id"].get<int>();
        string title = doc.value("title", "");
        string text = doc.value("text", "");

        // Index both title and body text
        string fullText = title + " " + text;
        vector<string> tokens = tokenize(fullText);

        int docLen = tokens.size();
        docLengths[docId] = docLen;
        totalDocLen += docLen;
        docCount++;

        // Calculate term frequencies in current document
        unordered_map<string, int> termFrequencies;
        for (const auto &token : tokens)
        {
            termFrequencies[token]++;
        }

        // Add to inverted index
        for (const auto &[term, tf] : termFrequencies)
        {
            invertedIndex[term].push_back({docId, tf});
        }
    }

    double avgDocLen = docCount > 0 ? (totalDocLen / docCount) : 0.0;

    cout << "Indexing finished. Document count: " << docCount
         << ", Average doc length: " << avgDocLen << endl;

    // Serialize index to JSON
    json indexJson;
    indexJson["doc_count"] = docCount;
    indexJson["avg_doc_len"] = avgDocLen;

    // Map doc_lengths keys to string because JSON object keys must be strings
    json docLengthsJson = json::object();
    for (const auto &[docId, len] : docLengths)
    {
        docLengthsJson[to_string(docId)] = len;
    }
    indexJson["doc_lengths"] = docLengthsJson;

    // Map inverted index
    json postingsJson = json::object();
    for (const auto &[term, postings] : invertedIndex)
    {
        json postList = json::array();
        for (const auto &[docId, tf] : postings)
        {
            postList.push_back({docId, tf});
        }
        postingsJson[term] = postList;
    }
    indexJson["index"] = postingsJson;

    cout << "Writing index to: " << indexPath << endl;
    ofstream indexFile(indexPath);
    if (!indexFile.is_open())
    {
        cerr << "Error: Could not open output index file: " << indexPath << endl;
        return 1;
    }
    indexFile << indexJson.dump(4);
    indexFile.close();

    cout << "Index written successfully." << endl;
    return 0;
}
