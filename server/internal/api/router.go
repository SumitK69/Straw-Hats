// Package api provides the REST API router for the Sentinel dashboard.
package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/sentinel-io/sentinel/server/internal/ca"
	"github.com/sentinel-io/sentinel/server/internal/config"
	"github.com/sentinel-io/sentinel/server/internal/store"
)

// NewRouter creates the REST API router with all route groups.
func NewRouter(cfg *config.Config, osClient *store.Client, certAuth *ca.CertAuthority, log *zap.SugaredLogger) http.Handler {
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

		// Agents
		agents := v1.Group("/agents")
		{
			agents.GET("", listAgentsHandler(osClient))
			agents.GET("/:id", getAgentHandler())
			agents.DELETE("/:id", deleteAgentHandler())
		}

		// Alerts
		alerts := v1.Group("/alerts")
		{
			alerts.GET("", listAlertsHandler(osClient))
			alerts.GET("/:id", getAlertHandler())
			alerts.PATCH("/:id", updateAlertHandler())
		}

		// Events
		events := v1.Group("/events")
		{
			events.GET("", searchEventsHandler(osClient))
		}

		// Rules
		rules := v1.Group("/rules")
		{
			rules.GET("", listRulesHandler())
			rules.POST("", createRuleHandler())
			rules.PUT("/:id", updateRuleHandler())
			rules.DELETE("/:id", deleteRuleHandler())
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
func getAgentHandler() gin.HandlerFunc        { return placeholder("get agent") }
func deleteAgentHandler() gin.HandlerFunc     { return placeholder("delete agent") }
func getAlertHandler() gin.HandlerFunc        { return placeholder("get alert") }
func updateAlertHandler() gin.HandlerFunc     { return placeholder("update alert") }
func listRulesHandler() gin.HandlerFunc       { return placeholder("list rules") }
func createRuleHandler() gin.HandlerFunc      { return placeholder("create rule") }
func updateRuleHandler() gin.HandlerFunc      { return placeholder("update rule") }
func deleteRuleHandler() gin.HandlerFunc      { return placeholder("delete rule") }
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
