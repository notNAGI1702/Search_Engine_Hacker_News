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

// Splits on all non-alphanumeric characters, normalizes to lowercase
std::vector<std::string> tokenize(const std::string& text) {
    std::vector<std::string> tokens;
    std::string current;
    for (char c : text) {
        if (std::isalnum(static_cast<unsigned char>(c))) {
            current += std::tolower(static_cast<unsigned char>(c));
        } else {
            if (!current.empty()) {
                tokens.push_back(current);
                current.clear();
            }
        }
    }
    if (!current.empty()) {
        tokens.push_back(current);
    }
    return tokens;
}

int main() {
    std::string corpusPath = "../data/hn_corpus.json";
    std::string indexPath = "../data/inverted_index.json";

    std::cout << "Loading corpus from: " << corpusPath << std::endl;
    std::ifstream corpusFile(corpusPath);
    if (!corpusFile.is_open()) {
        std::cerr << "Error: Could not open corpus file: " << corpusPath << std::endl;
        std::cerr << "Ensure exportCorpus.js has been run first." << std::endl;
        return 1;
    }

    json corpusJson;
    try {
        corpusFile >> corpusJson;
    } catch (const std::exception& e) {
        std::cerr << "Error parsing corpus JSON: " << e.what() << std::endl;
        return 1;
    }
    corpusFile.close();

    if (!corpusJson.is_array()) {
        std::cerr << "Error: Corpus JSON is not an array." << std::endl;
        return 1;
    }

    std::cout << "Parsing " << corpusJson.size() << " documents..." << std::endl;

    double totalDocLen = 0;
    int docCount = 0;
    std::unordered_map<int, int> docLengths;
    // inverted_index maps: term -> list of postings {doc_id, tf}
    std::unordered_map<std::string, std::vector<std::pair<int, int>>> invertedIndex;

    for (const auto& doc : corpusJson) {
        if (!doc.contains("id") || !doc["id"].is_number_integer()) {
            continue;
        }
        int docId = doc["id"].get<int>();
        std::string title = doc.value("title", "");
        std::string text = doc.value("text", "");

        // Index both title and body text
        std::string fullText = title + " " + text;
        std::vector<std::string> tokens = tokenize(fullText);

        int docLen = tokens.size();
        docLengths[docId] = docLen;
        totalDocLen += docLen;
        docCount++;

        // Calculate term frequencies in current document
        std::unordered_map<std::string, int> termFrequencies;
        for (const auto& token : tokens) {
            termFrequencies[token]++;
        }

        // Add to inverted index
        for (const auto& [term, tf] : termFrequencies) {
            invertedIndex[term].push_back({docId, tf});
        }
    }

    double avgDocLen = docCount > 0 ? (totalDocLen / docCount) : 0.0;

    std::cout << "Indexing finished. Document count: " << docCount 
              << ", Average doc length: " << avgDocLen << std::endl;

    // Serialize index to JSON
    json indexJson;
    indexJson["doc_count"] = docCount;
    indexJson["avg_doc_len"] = avgDocLen;
    
    // Map doc_lengths keys to string because JSON object keys must be strings
    json docLengthsJson = json::object();
    for (const auto& [docId, len] : docLengths) {
        docLengthsJson[std::to_string(docId)] = len;
    }
    indexJson["doc_lengths"] = docLengthsJson;

    // Map inverted index
    json postingsJson = json::object();
    for (const auto& [term, postings] : invertedIndex) {
        json postList = json::array();
        for (const auto& [docId, tf] : postings) {
            postList.push_back({docId, tf});
        }
        postingsJson[term] = postList;
    }
    indexJson["index"] = postingsJson;

    std::cout << "Writing index to: " << indexPath << std::endl;
    std::ofstream indexFile(indexPath);
    if (!indexFile.is_open()) {
        std::cerr << "Error: Could not open output index file: " << indexPath << std::endl;
        return 1;
    }
    indexFile << indexJson.dump(4);
    indexFile.close();

    std::cout << "Index written successfully." << std::endl;
    return 0;
}
