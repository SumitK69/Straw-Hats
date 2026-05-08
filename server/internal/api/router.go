// Package api provides the REST API router for the Sentinel dashboard.
package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/sentinel-io/sentinel/server/internal/ca"
	"github.com/sentinel-io/sentinel/server/internal/config"
	"github.com/sentinel-io/sentinel/server/internal/detection"
	"github.com/sentinel-io/sentinel/server/internal/store"
)

// NewRouter creates the REST API router with all route groups.
func NewRouter(cfg *config.Config, osClient *store.Client, certAuth *ca.CertAuthority, detEngine *detection.Engine, log *zap.SugaredLogger) http.Handler {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(corsMiddleware())

	// Health
	r.GET("/api/v1/health", healthHandler(osClient))

	// API v1 route groups
	v1 := r.Group("/api/v1")
	{
		// Enrollment
		v1.POST("/enrollment/token", generateTokenHandler(cfg.JWT.SigningKey))

		// Overview stats
		v1.GET("/overview/stats", overviewStatsHandler(osClient))

		// Agents
		agents := v1.Group("/agents")
		{
			agents.GET("", listAgentsHandler(osClient))
			agents.GET("/:id", getAgentHandler())
			agents.DELETE("/:id", deleteAgentHandler(osClient))
		}

		// Alerts
		alerts := v1.Group("/alerts")
		{
			alerts.GET("", listAlertsHandler(osClient))
			alerts.GET("/histogram", histogramHandler(osClient, "sentinel-alerts*", "@timestamp"))
			alerts.GET("/:id", getAlertHandler())
			alerts.PATCH("/:id", updateAlertHandler())
		}

		// Events
		events := v1.Group("/events")
		{
			events.GET("", searchEventsHandler(osClient))
			events.GET("/histogram", histogramHandler(osClient, "sentinel-events*", "@timestamp"))
		}

		// Rules — connected to the detection engine
		rules := v1.Group("/rules")
		{
			rules.GET("", listRulesHandler(detEngine))
			rules.POST("", createRuleHandler(detEngine))
			rules.PUT("/:id", updateRuleHandler(detEngine))
			rules.DELETE("/:id", deleteRuleHandler(detEngine))
		}

		// Dashboard config
		dashboards := v1.Group("/dashboards")
		{
			dashboards.GET("", listDashboardsHandler())
			dashboards.POST("", createDashboardHandler())
			dashboards.PUT("/:id", updateDashboardHandler())
			dashboards.DELETE("/:id", deleteDashboardHandler())
		}
	}

	return r
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

// Placeholder handlers — will be implemented in later phases
func getAgentHandler() gin.HandlerFunc { return placeholder("get agent") }
func deleteAgentHandler(osClient *store.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if id == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "agent id is required"})
			return
		}
		if err := osClient.DeleteDoc(c.Request.Context(), "sentinel-agents", id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete agent: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "agent deleted", "agent_id": id})
	}
}
func getAlertHandler() gin.HandlerFunc    { return placeholder("get alert") }
func updateAlertHandler() gin.HandlerFunc { return placeholder("update alert") }

// ── Rules Handlers (connected to detection engine) ──────────────────

func listRulesHandler(engine *detection.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		rules := engine.GetRules()
		c.JSON(http.StatusOK, gin.H{"data": rules, "count": len(rules)})
	}
}

func createRuleHandler(engine *detection.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		var rule detection.Rule
		if err := c.ShouldBindJSON(&rule); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule payload: " + err.Error()})
			return
		}
		if rule.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "rule name is required"})
			return
		}
		engine.AddRule(rule)
		c.JSON(http.StatusCreated, gin.H{"message": "rule created", "rule": rule})
	}
}

func updateRuleHandler(engine *detection.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var rule detection.Rule
		if err := c.ShouldBindJSON(&rule); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule payload: " + err.Error()})
			return
		}
		if !engine.UpdateRule(id, rule) {
			c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "rule updated"})
	}
}

func deleteRuleHandler(engine *detection.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !engine.DeleteRule(id) {
			c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "rule deleted"})
	}
}

// ── Dashboard placeholders ──────────────────────────────────────────

func listDashboardsHandler() gin.HandlerFunc  { return placeholder("list dashboards") }
func createDashboardHandler() gin.HandlerFunc { return placeholder("create dashboard") }
func updateDashboardHandler() gin.HandlerFunc { return placeholder("update dashboard") }
func deleteDashboardHandler() gin.HandlerFunc { return placeholder("delete dashboard") }

func placeholder(name string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusNotImplemented, gin.H{
			"message": name + " — not yet implemented",
		})
	}
}
