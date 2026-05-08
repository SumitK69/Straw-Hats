// Package detection provides rule loading from YAML files (Sigma-compatible format).
package detection

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// ── Sigma-compatible YAML rule schema ────────────────────────────────────

// SigmaRule represents a detection rule in Sigma-compatible YAML format.
type SigmaRule struct {
	Title       string            `yaml:"title"       json:"title"`
	ID          string            `yaml:"id"          json:"id"`
	Status      string            `yaml:"status"      json:"status"`
	Description string            `yaml:"description" json:"description"`
	Author      string            `yaml:"author"      json:"author"`
	Date        string            `yaml:"date"        json:"date"`
	Tags        []string          `yaml:"tags"        json:"tags"`
	LogSource   SigmaLogSource    `yaml:"logsource"   json:"logsource"`
	Detection   SigmaDetection    `yaml:"detection"   json:"detection"`
	Level       string            `yaml:"level"       json:"level"`
	Enabled     *bool             `yaml:"enabled"     json:"enabled"`
	EventTypes  []int32           `yaml:"event_types" json:"event_types"`
	Source      string            `yaml:"-"           json:"source"` // "sigma" or "custom"
}

// SigmaLogSource describes the log source for a rule.
type SigmaLogSource struct {
	Product  string `yaml:"product"  json:"product"`
	Service  string `yaml:"service"  json:"service"`
	Category string `yaml:"category" json:"category,omitempty"`
}

// SigmaDetection holds the detection logic.
// Selections are named field-match groups; Condition combines them with boolean logic.
type SigmaDetection struct {
	Selections map[string]map[string]interface{} `yaml:"-"       json:"selections,omitempty"`
	Condition  string                            `yaml:"condition" json:"condition"`
}

// UnmarshalYAML custom-unmarshals the detection block.
// It separates the "condition" key from the named selections.
func (d *SigmaDetection) UnmarshalYAML(value *yaml.Node) error {
	// First decode into a generic map
	var raw map[string]interface{}
	if err := value.Decode(&raw); err != nil {
		return err
	}

	d.Selections = make(map[string]map[string]interface{})

	for key, val := range raw {
		if key == "condition" {
			if s, ok := val.(string); ok {
				d.Condition = s
			}
			continue
		}
		// Every other key is a selection name
		switch v := val.(type) {
		case map[string]interface{}:
			d.Selections[key] = v
		}
	}
	return nil
}

// ── Convert Sigma YAML to engine Rule ────────────────────────────────────

// sigmaToRule converts a SigmaRule into the engine's internal Rule struct.
func sigmaToRule(sigma SigmaRule) Rule {
	// Map Sigma level names to our severity names
	severity := mapLevel(sigma.Level)

	// Build conditions from detection selections
	conditions := buildConditions(sigma.Detection)

	enabled := true
	if sigma.Enabled != nil {
		enabled = *sigma.Enabled
	}

	// Map Sigma tags to our tag format (strip "attack." prefix for display)
	tags := make([]string, 0, len(sigma.Tags))
	for _, t := range sigma.Tags {
		tags = append(tags, t)
	}

	now := time.Now().UTC().Format(time.RFC3339)

	return Rule{
		ID:          sigma.ID,
		Name:        sigma.Title,
		Description: sigma.Description,
		Severity:    severity,
		Enabled:     enabled,
		EventTypes:  sigma.EventTypes,
		Conditions:  conditions,
		Tags:        tags,
		Source:      sigma.Source,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// mapLevel converts Sigma level names to our severity constants.
func mapLevel(level string) string {
	switch strings.ToLower(level) {
	case "critical":
		return SevCritical
	case "high":
		return SevHigh
	case "medium":
		return SevMedium
	case "low":
		return SevLow
	case "informational", "info":
		return SevInfo
	default:
		return SevMedium
	}
}

// buildConditions converts Sigma detection selections into flat Condition slices.
// This handles the subset of Sigma syntax that Sentinel supports:
//   field|contains, field|equals, field|startswith, field|endswith, field|re
// AND logic is applied across all selections referenced in the condition.
func buildConditions(det SigmaDetection) []Condition {
	var conditions []Condition

	for _, sel := range det.Selections {
		for fieldSpec, val := range sel {
			field, operator := parseFieldSpec(fieldSpec)
			value := fmt.Sprintf("%v", val)
			conditions = append(conditions, Condition{
				Field:    field,
				Operator: operator,
				Value:    value,
			})
		}
	}

	return conditions
}

// parseFieldSpec splits a Sigma field|modifier into (field, operator).
func parseFieldSpec(spec string) (string, string) {
	parts := strings.SplitN(spec, "|", 2)
	field := parts[0]
	if len(parts) == 1 {
		return field, "contains" // default operator
	}

	switch parts[1] {
	case "contains":
		return field, "contains"
	case "equals":
		return field, "equals"
	case "startswith":
		return field, "starts_with"
	case "endswith":
		return field, "ends_with"
	case "re":
		return field, "regex"
	default:
		return field, "contains"
	}
}

// ── YAML File Loader ─────────────────────────────────────────────────────

// LoadRulesFromDir reads all .yml / .yaml files from a directory and returns Rules.
func LoadRulesFromDir(dir string, source string) ([]Rule, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read rules directory %s: %w", dir, err)
	}

	var rules []Rule
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(entry.Name()))
		if ext != ".yml" && ext != ".yaml" {
			continue
		}

		filePath := filepath.Join(dir, entry.Name())
		loaded, err := LoadRulesFromFile(filePath, source)
		if err != nil {
			// Log but continue loading other files
			fmt.Fprintf(os.Stderr, "WARN: skipping rule file %s: %v\n", filePath, err)
			continue
		}
		rules = append(rules, loaded...)
	}

	return rules, nil
}

// LoadRulesFromFile parses a single YAML file into Rules.
// A file may contain multiple YAML documents separated by ---.
func LoadRulesFromFile(filePath string, source string) ([]Rule, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("read file %s: %w", filePath, err)
	}

	return ParseRulesYAML(data, source)
}

// ParseRulesYAML parses YAML bytes (possibly multi-document) into Rules.
func ParseRulesYAML(data []byte, source string) ([]Rule, error) {
	var rules []Rule

	decoder := yaml.NewDecoder(strings.NewReader(string(data)))
	for {
		var sigma SigmaRule
		err := decoder.Decode(&sigma)
		if err != nil {
			if err.Error() == "EOF" {
				break
			}
			return rules, fmt.Errorf("parse YAML: %w", err)
		}
		if sigma.ID == "" && sigma.Title == "" {
			continue // skip empty documents
		}
		sigma.Source = source
		rules = append(rules, sigmaToRule(sigma))
	}

	return rules, nil
}
