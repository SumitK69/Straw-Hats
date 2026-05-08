// Package store provides the OpenSearch client and index management.
package store

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	opensearch "github.com/opensearch-project/opensearch-go/v2"
	opensearchapi "github.com/opensearch-project/opensearch-go/v2/opensearchapi"
	"github.com/sentinel-io/sentinel/server/internal/config"
)

// Client wraps the OpenSearch client with Sentinel-specific operations.
type Client struct {
	os *opensearch.Client
}

// NewOpenSearchClient creates a new OpenSearch client.
func NewOpenSearchClient(cfg config.OpenSearchConfig) (*Client, error) {
	client, err := opensearch.NewClient(opensearch.Config{
		Addresses: cfg.Addresses,
		Username:  cfg.Username,
		Password:  cfg.Password,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("opensearch client: %w", err)
	}
	return &Client{os: client}, nil
}

// Ping checks OpenSearch connectivity.
func (c *Client) Ping(ctx context.Context) error {
	res, err := c.os.Ping()
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.IsError() {
		return fmt.Errorf("opensearch ping: %s", res.Status())
	}
	return nil
}

// indexTemplates defines the index templates from PRD Section 10.1.
var indexTemplates = map[string]map[string]interface{}{
	"sentinel-events": {
		"index_patterns": []string{"sentinel-events-*"},
		"template": map[string]interface{}{
			"settings": map[string]interface{}{
				"number_of_shards":   1,
				"number_of_replicas": 0,
				"refresh_interval":   "5s",
			},
			"mappings": map[string]interface{}{
				"properties": map[string]interface{}{
					"@timestamp": map[string]string{"type": "date"},
					"agent_id":   map[string]string{"type": "keyword"},
					"event_type": map[string]string{"type": "keyword"},
					"severity":   map[string]string{"type": "keyword"},
					"hostname":   map[string]string{"type": "keyword"},
					"message":    map[string]string{"type": "text"},
					"raw_data":   map[string]string{"type": "text"},
				},
			},
		},
	},
	"sentinel-alerts": {
		"index_patterns": []string{"sentinel-alerts-*"},
		"template": map[string]interface{}{
			"settings": map[string]interface{}{
				"number_of_shards": 1, "number_of_replicas": 0, "refresh_interval": "5s",
			},
			"mappings": map[string]interface{}{
				"properties": map[string]interface{}{
					"@timestamp":  map[string]string{"type": "date"},
					"agent_id":    map[string]string{"type": "keyword"},
					"rule_id":     map[string]string{"type": "keyword"},
					"rule_name":   map[string]string{"type": "text"},
					"severity":    map[string]string{"type": "keyword"},
					"status":      map[string]string{"type": "keyword"},
					"description": map[string]string{"type": "text"},
				},
			},
		},
	},
	"sentinel-agents": {
		"index_patterns": []string{"sentinel-agents"},
		"template": map[string]interface{}{
			"settings": map[string]interface{}{
				"number_of_shards": 1, "number_of_replicas": 0,
			},
			"mappings": map[string]interface{}{
				"properties": map[string]interface{}{
					"agent_id":     map[string]string{"type": "keyword"},
					"hostname":     map[string]string{"type": "keyword"},
					"os":           map[string]string{"type": "keyword"},
					"arch":         map[string]string{"type": "keyword"},
					"version":      map[string]string{"type": "keyword"},
					"status":       map[string]string{"type": "keyword"},
					"last_seen":    map[string]string{"type": "date"},
					"enrolled_at":  map[string]string{"type": "date"},
					"cert_expires": map[string]string{"type": "date"},
				},
			},
		},
	},
}

// ApplyTemplates creates all index templates in OpenSearch using the REST API.
func (c *Client) ApplyTemplates(ctx context.Context) error {
	for name, tmpl := range indexTemplates {
		body, _ := json.Marshal(tmpl)
		req := opensearchapi.IndicesPutIndexTemplateRequest{
			Name: name,
			Body: strings.NewReader(string(body)),
		}
		res, err := req.Do(ctx, c.os)
		if err != nil {
			return fmt.Errorf("apply template %s: %w", name, err)
		}
		res.Body.Close()
	}
	return nil
}

// BulkIndex sends a batch of documents to OpenSearch.
func (c *Client) BulkIndex(ctx context.Context, index string, docs []map[string]interface{}) error {
	if len(docs) == 0 {
		return nil
	}
	var buf bytes.Buffer
	for _, doc := range docs {
		meta := map[string]interface{}{"index": map[string]string{"_index": index}}
		metaJSON, _ := json.Marshal(meta)
		docJSON, _ := json.Marshal(doc)
		buf.Write(metaJSON)
		buf.WriteByte('\n')
		buf.Write(docJSON)
		buf.WriteByte('\n')
	}
	res, err := c.os.Bulk(strings.NewReader(buf.String()))
	if err != nil {
		return fmt.Errorf("bulk index: %w", err)
	}
	defer res.Body.Close()
	if res.IsError() {
		return fmt.Errorf("bulk index error: %s", res.Status())
	}
	return nil
}

// Search executes a raw search query against OpenSearch.
func (c *Client) Search(ctx context.Context, index string, queryBody []byte) (map[string]interface{}, error) {
	req := opensearchapi.SearchRequest{
		Index: []string{index},
		Body:  bytes.NewReader(queryBody),
	}

	res, err := req.Do(ctx, c.os)
	if err != nil {
		return nil, fmt.Errorf("search error: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("search returned error: %s", res.Status())
	}

	var result map[string]interface{}
	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode search response: %w", err)
	}

	return result, nil
}

// IndexDoc upserts a single document by ID into the given index.
func (c *Client) IndexDoc(ctx context.Context, index, docID string, doc map[string]interface{}) error {
	body, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("marshal doc: %w", err)
	}

	req := opensearchapi.IndexRequest{
		Index:      index,
		DocumentID: docID,
		Body:       strings.NewReader(string(body)),
		Refresh:    "true",
	}

	res, err := req.Do(ctx, c.os)
	if err != nil {
		return fmt.Errorf("index doc: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("index doc error: %s", res.Status())
	}
	return nil
}

// UpdateDoc updates specific fields of an existing document by ID.
func (c *Client) UpdateDoc(ctx context.Context, index, docID string, doc map[string]interface{}) error {
	updateBody := map[string]interface{}{
		"doc": doc,
	}
	body, err := json.Marshal(updateBody)
	if err != nil {
		return fmt.Errorf("marshal update doc: %w", err)
	}

	req := opensearchapi.UpdateRequest{
		Index:      index,
		DocumentID: docID,
		Body:       strings.NewReader(string(body)),
		Refresh:    "true",
	}

	res, err := req.Do(ctx, c.os)
	if err != nil {
		return fmt.Errorf("update doc: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("update doc error: %s", res.Status())
	}
	return nil
}

// DeleteDoc removes a document by ID from the given index.
func (c *Client) DeleteDoc(ctx context.Context, index, docID string) error {
	req := opensearchapi.DeleteRequest{
		Index:      index,
		DocumentID: docID,
		Refresh:    "true",
	}

	res, err := req.Do(ctx, c.os)
	if err != nil {
		return fmt.Errorf("delete doc: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("delete doc error: %s", res.Status())
	}
	return nil
}
