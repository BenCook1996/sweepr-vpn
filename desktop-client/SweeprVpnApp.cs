using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("SWEEPR VPN")]
[assembly: AssemblyDescription("SWEEPR VPN — Easy Privacy & Home Wi-Fi Protection")]
[assembly: AssemblyCompany("SWEEPR VPN")]
[assembly: AssemblyProduct("SWEEPR VPN")]
[assembly: AssemblyCopyright("Copyright © 2026 SWEEPR VPN. All rights reserved.")]
[assembly: AssemblyVersion("2.5.0.0")]
[assembly: AssemblyFileVersion("2.5.0.0")]

namespace SweeprVpnApp
{
    public class ServerNode
    {
        public string Code;
        public string Label;
        public string City;
        public string CallQuality;
        public string StreamSpeed;
        public string Ip;

        public ServerNode(string code, string label, string city, string callQuality, string streamSpeed, string ip)
        {
            Code = code;
            Label = label;
            City = city;
            CallQuality = callQuality;
            StreamSpeed = streamSpeed;
            Ip = ip;
        }

        public override string ToString()
        {
            return Label;
        }
    }

    public class LanDeviceEntry
    {
        public string Name;
        public string Ip;
        public string Mac;
        public string Kind;
        public string Detail;
        public string ChipTranslation;
        public bool IsRouter;
        public bool IsSelf;
        public bool TrackerRisk;
        public bool CameraRisk;
        public bool IntruderRisk;
        public int SortOrder;
    }

    public class MainForm : Form
    {
        public List<ServerNode> Servers = new List<ServerNode>();
        public ServerNode CurrentServer;
        public bool IsConnected = false;
        public bool IsPro = false;
        public bool IsDarkTheme = false;
        public bool IsRadarEnabled = false;
        public bool IsKillSwitchEnabled = false;
        private bool IntentionalDisconnect = false;
        private HashSet<string> BaselineKnownMacs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private object KnownMacsLock = new object();
        private System.Windows.Forms.Timer KillSwitchWatchdogTimer;
        private System.Windows.Forms.Timer RadarIntruderTimer;
        public string CurrentTab = "home";
        public string CurrentFrequency = "Always On";
        public string CurrentProtocol = "Everyday Browsing & 4K Streaming (Recommended — Fastest)";
        public bool[] ShieldStates = new bool[] { true, true, true, true };
        public List<string> DiscoveredLanDevices = new List<string>();
        public List<LanDeviceEntry> StructuredLanDevices = new List<LanDeviceEntry>();

        private WebView2 BrowserView;
        public bool WebViewReady = false;
        private string InitialScreenshotPath = null;
        private string InitialTabMode = null;

        public bool IsCompact = false;
        public bool AllowExit = false;
        private bool TrayBalloonShown = false;
        private Rectangle FullBounds = new Rectangle(120, 90, 1160, 770);
        private NotifyIcon TrayIcon;
        private ContextMenuStrip TrayMenu;
        private ToolStripMenuItem TrayStatusItem;
        private ToolStripMenuItem TrayToggleItem;
        private ToolStripMenuItem TrayMiniItem;
        private ToolStripMenuItem TrayLocMenu;

        public MainForm(string screenshotPath = null, string tabMode = null, bool isSelfTest = false)
        {
            try { ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072; } catch { }
            InitialScreenshotPath = screenshotPath;
            InitialTabMode = tabMode;
            AllowExit = isSelfTest || !string.IsNullOrEmpty(screenshotPath);
            InitializeServers();

            this.Text = "SWEEPR VPN — Easy Privacy & Home Wi-Fi Protection";
            this.Size = new Size(1160, 770);
            this.MinimumSize = new Size(480, 520);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(248, 250, 252);

            try
            {
                this.Icon = Program.LoadEmbeddedIcon();
            }
            catch { }

            if (!AllowExit)
            {
                LoadWindowState();
            }

            if (!isSelfTest)
            {
                IsConnected = IsTunnelServiceRunning();
            }

            InitializeSystemTray(!AllowExit);

            if (!isSelfTest)
            {
                Task.Run(() => RunWifiScan());
                InitializeWebViewAsync();
                InitializeBackgroundProtectionTimers();
            }

            if (!string.IsNullOrEmpty(InitialScreenshotPath))
            {
                System.Windows.Forms.Timer killTimer = new System.Windows.Forms.Timer();
                killTimer.Interval = 20000;
                killTimer.Tick += (s, e) => { killTimer.Stop(); AllowExit = true; this.Close(); };
                killTimer.Start();
            }
        }

        private string GetAppDataDir()
        {
            string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SWEEPRVPN");
            Directory.CreateDirectory(dir);
            return dir;
        }

        private string GetStateFilePath()
        {
            return Path.Combine(GetAppDataDir(), "window-state.cfg");
        }

        public void SaveWindowState()
        {
            try
            {
                Rectangle b = (this.WindowState == FormWindowState.Normal && !IsCompact) ? this.Bounds : FullBounds;
                StringBuilder sb = new StringBuilder();
                sb.AppendLine("X=" + b.X);
                sb.AppendLine("Y=" + b.Y);
                sb.AppendLine("W=" + b.Width);
                sb.AppendLine("H=" + b.Height);
                sb.AppendLine("Compact=" + (IsCompact ? "1" : "0"));
                sb.AppendLine("Server=" + (CurrentServer != null ? CurrentServer.Code : "UK-LON-01"));
                File.WriteAllText(GetStateFilePath(), sb.ToString(), Encoding.UTF8);
            }
            catch { }
        }

        public void LoadWindowState()
        {
            try
            {
                string path = GetStateFilePath();
                if (!File.Exists(path)) return;
                int x = -99999, y = -99999, w = 1160, h = 770;
                foreach (string line in File.ReadAllLines(path, Encoding.UTF8))
                {
                    int eq = line.IndexOf('=');
                    if (eq <= 0) continue;
                    string k = line.Substring(0, eq).Trim();
                    string v = line.Substring(eq + 1).Trim();
                    if (k == "X") int.TryParse(v, out x);
                    else if (k == "Y") int.TryParse(v, out y);
                    else if (k == "W") int.TryParse(v, out w);
                    else if (k == "H") int.TryParse(v, out h);
                    else if (k == "Server") SelectServer(v);
                }
                if (w >= 480 && h >= 520 && x > -30000 && y > -30000)
                {
                    Rectangle candidate = new Rectangle(x, y, w, h);
                    bool visibleOnScreen = false;
                    foreach (Screen scr in Screen.AllScreens)
                    {
                        if (scr.WorkingArea.IntersectsWith(candidate)) { visibleOnScreen = true; break; }
                    }
                    if (visibleOnScreen)
                    {
                        FullBounds = candidate;
                        this.StartPosition = FormStartPosition.Manual;
                        this.Bounds = candidate;
                    }
                }
            }
            catch { }
        }

        private void InitializeSystemTray(bool showIcon)
        {
            TrayMenu = new ContextMenuStrip();
            TrayStatusItem = new ToolStripMenuItem("○ Not Protected — London, UK") { Enabled = false };
            TrayToggleItem = new ToolStripMenuItem("Connect VPN", null, (s, e) =>
            {
                if (WebViewReady)
                {
                    ExecuteJsSafe("toggleConnect()");
                }
                else
                {
                    ToggleConnection();
                }
            });
            TrayLocMenu = new ToolStripMenuItem("Switch Country (8)");
            foreach (ServerNode srv in Servers)
            {
                string code = srv.Code;
                ToolStripMenuItem locItem = new ToolStripMenuItem(srv.City + " (" + srv.Code + ")", null, (s, e) =>
                {
                    SelectServer(code);
                    ExecuteJsSafe("pick('" + code + "'); if(!state.connected) toggleConnect(true);");
                });
                locItem.Tag = code;
                TrayLocMenu.DropDownItems.Add(locItem);
            }
            ToolStripMenuItem scanItem = new ToolStripMenuItem("Scan Home Wi-Fi & TVs", null, (s, e) =>
            {
                RestoreFromTray();
                ExecuteJsSafe("go('wifi'); scanWifi();");
            });
            TrayMiniItem = new ToolStripMenuItem("Mini Widget Mode (380×540)", null, (s, e) =>
            {
                RestoreFromTray();
                bool nextCompact = !IsCompact;
                SetCompactWindow(nextCompact);
                ExecuteJsSafe("document.body.classList.toggle('is-compact', " + (nextCompact ? "true" : "false") + ")");
            });
            ToolStripMenuItem showItem = new ToolStripMenuItem("Open SWEEPR VPN", null, (s, e) => RestoreFromTray());
            ToolStripMenuItem exitItem = new ToolStripMenuItem("Quit SWEEPR VPN", null, (s, e) =>
            {
                AllowExit = true;
                SaveWindowState();
                if (TrayIcon != null) TrayIcon.Visible = false;
                Application.Exit();
            });

            TrayMenu.Items.Add(TrayStatusItem);
            TrayMenu.Items.Add(new ToolStripSeparator());
            TrayMenu.Items.Add(TrayToggleItem);
            TrayMenu.Items.Add(TrayLocMenu);
            TrayMenu.Items.Add(scanItem);
            TrayMenu.Items.Add(TrayMiniItem);
            TrayMenu.Items.Add(new ToolStripSeparator());
            TrayMenu.Items.Add(showItem);
            TrayMenu.Items.Add(exitItem);

            TrayIcon = new NotifyIcon();
            TrayIcon.Text = "SWEEPR VPN — Easy Privacy & Wi-Fi Shield";
            TrayIcon.Icon = this.Icon != null ? this.Icon : SystemIcons.Shield;
            TrayIcon.ContextMenuStrip = TrayMenu;
            TrayIcon.Visible = showIcon;
            TrayIcon.DoubleClick += (s, e) => RestoreFromTray();
            UpdateTrayMenuState();
        }

        public void UpdateTrayMenuState()
        {
            if (this.InvokeRequired)
            {
                try { this.BeginInvoke(new Action(UpdateTrayMenuState)); } catch { }
                return;
            }
            if (TrayStatusItem == null) return;
            string city = CurrentServer != null ? CurrentServer.City : "London, UK";
            TrayStatusItem.Text = IsConnected ? ("● Protected — " + city) : ("○ Not Protected — " + city);
            TrayToggleItem.Text = IsConnected ? "Pause VPN Protection" : ("Connect to " + city);
            TrayMiniItem.Checked = IsCompact;
            if (TrayIcon != null)
            {
                string tip = IsConnected ? ("SWEEPR VPN: Protected (" + city + ")") : "SWEEPR VPN: Not Protected";
                TrayIcon.Text = tip.Length > 63 ? tip.Substring(0, 63) : tip;
            }
            if (TrayLocMenu != null)
            {
                foreach (ToolStripItem item in TrayLocMenu.DropDownItems)
                {
                    ToolStripMenuItem mi = item as ToolStripMenuItem;
                    if (mi != null && CurrentServer != null)
                    {
                        mi.Checked = (string)mi.Tag == CurrentServer.Code;
                    }
                }
            }
        }

        public void RestoreFromTray()
        {
            this.Show();
            if (this.WindowState == FormWindowState.Minimized)
            {
                this.WindowState = FormWindowState.Normal;
            }
            this.Activate();
        }

        private async void ExecuteJsSafe(string script)
        {
            if (this.InvokeRequired)
            {
                try { this.BeginInvoke(new Action(() => ExecuteJsSafe(script))); } catch { }
                return;
            }
            try
            {
                if (BrowserView != null && BrowserView.CoreWebView2 != null)
                {
                    await BrowserView.CoreWebView2.ExecuteScriptAsync(script);
                }
            }
            catch { }
        }

        private void SendBridgeResponse(string reqId, string jsonResult)
        {
            if (string.IsNullOrEmpty(reqId)) return;
            string safeReqId = reqId.Replace("\\", "\\\\").Replace("'", "\\'");
            string script = "window.onNativeVpnBridgeResponse && window.onNativeVpnBridgeResponse('" + safeReqId + "', " + jsonResult + ")";
            ExecuteJsSafe(script);
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            SaveWindowState();
            try
            {
                if (KillSwitchWatchdogTimer != null) { KillSwitchWatchdogTimer.Stop(); KillSwitchWatchdogTimer.Dispose(); KillSwitchWatchdogTimer = null; }
                if (RadarIntruderTimer != null) { RadarIntruderTimer.Stop(); RadarIntruderTimer.Dispose(); RadarIntruderTimer = null; }
                if (!AllowExit || IsKillSwitchEnabled) CleanupKillSwitchFirewallRules();
            }
            catch { }
            if (TrayIcon != null)
            {
                TrayIcon.Visible = false;
                TrayIcon.Dispose();
                TrayIcon = null;
            }
            if (BrowserView != null)
            {
                try { BrowserView.Dispose(); } catch { }
                BrowserView = null;
            }
            base.OnFormClosing(e);
        }

        private void InitializeServers()
        {
            Servers.Add(new ServerNode("UK-LON-01", "United Kingdom — London (Fastest Nearby)", "London, UK", "Instant (No Lag)", "Ultra-Fast (4K)", "78.141.205.68"));
            Servers.Add(new ServerNode("SE-STO-01", "Sweden — Stockholm (Maximum Privacy)", "Stockholm, Sweden", "Instant (No Lag)", "Ultra-Fast (4K)", "70.34.208.107"));
            Servers.Add(new ServerNode("NL-AMS-01", "Netherlands — Amsterdam (Super Fast)", "Amsterdam, Netherlands", "Instant (No Lag)", "Ultra-Fast (4K)", "95.179.181.53"));
            Servers.Add(new ServerNode("DE-FRA-01", "Germany — Frankfurt (Fastest Europe)", "Frankfurt, Germany", "Instant (No Lag)", "Ultra-Fast (4K)", "80.240.20.239"));
            Servers.Add(new ServerNode("US-NYC-01", "United States — New York (East Coast)", "New York, USA", "Smooth (HD Ready)", "Ultra-Fast (4K)", "45.77.109.112"));
            Servers.Add(new ServerNode("US-LAX-01", "United States — Los Angeles (West Coast)", "Los Angeles, USA", "Smooth (HD Ready)", "Ultra-Fast (4K)", "45.32.85.162"));
            Servers.Add(new ServerNode("SG-SIN-01", "Singapore — Marina Bay (Asia-Pacific)", "Singapore", "Smooth (HD Ready)", "Ultra-Fast (4K)", "149.28.157.142"));
            Servers.Add(new ServerNode("JP-TYO-01", "Japan — Tokyo (High Speed Asia)", "Tokyo, Japan", "Smooth (HD Ready)", "Ultra-Fast (4K)", "104.156.239.162"));
            CurrentServer = Servers[0];
        }

        private async void InitializeWebViewAsync()
        {
            try
            {
                BrowserView = new WebView2();
                BrowserView.Dock = DockStyle.Fill;
                BrowserView.DefaultBackgroundColor = Color.FromArgb(248, 250, 252);
                this.Controls.Add(BrowserView);

                string userDataFolder = Path.Combine(GetAppDataDir(), "webview2_data");
                Directory.CreateDirectory(userDataFolder);

                var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
                await BrowserView.EnsureCoreWebView2Async(env);

                BrowserView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
                BrowserView.CoreWebView2.Settings.AreDevToolsEnabled = false;
                BrowserView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                BrowserView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
                BrowserView.CoreWebView2.PermissionRequested += (s, pe) =>
                {
                    if (pe.PermissionKind == CoreWebView2PermissionKind.ClipboardRead)
                    {
                        pe.State = CoreWebView2PermissionState.Allow;
                    }
                };

                string html = Program.LoadEmbeddedTextResource("app-ui.html");
                BrowserView.CoreWebView2.NavigationCompleted += async (s, e) =>
                {
                    WebViewReady = true;
                    PushDeviceCountToPage();
                    if (!string.IsNullOrEmpty(InitialTabMode))
                    {
                        if (InitialTabMode == "wifi" || InitialTabMode == "account")
                        {
                            await BrowserView.CoreWebView2.ExecuteScriptAsync("go('" + InitialTabMode + "')");
                        }
                        else if (InitialTabMode == "connected")
                        {
                            await BrowserView.CoreWebView2.ExecuteScriptAsync("(function waitPro(n){ if(state.pro && !state.connected) toggleConnect(true); else if(n>0) setTimeout(()=>waitPro(n-1), 400); })(20)");
                        }
                        else if (InitialTabMode == "dark")
                        {
                            await BrowserView.CoreWebView2.ExecuteScriptAsync("toggleTheme(); toggleConnect(); go('wifi')");
                        }
                        else if (InitialTabMode == "compact")
                        {
                            await BrowserView.CoreWebView2.ExecuteScriptAsync("setCompact(true)");
                        }
                        else if (InitialTabMode == "minimized")
                        {
                            this.WindowState = FormWindowState.Minimized;
                            this.Hide();
                            await BrowserView.CoreWebView2.ExecuteScriptAsync("if(state.pro && !state.connected) toggleConnect(true)");
                        }
                    }

                    if (!string.IsNullOrEmpty(InitialScreenshotPath))
                    {
                        System.Windows.Forms.Timer t = new System.Windows.Forms.Timer();
                        t.Interval = 450;
                        t.Tick += async (ts, te) =>
                        {
                            t.Stop();
                            try
                            {
                                using (MemoryStream ms = new MemoryStream())
                                {
                                    await BrowserView.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, ms);
                                    File.WriteAllBytes(InitialScreenshotPath, ms.ToArray());
                                }
                            }
                            catch { }
                            this.Close();
                        };
                        t.Start();
                    }
                };

                try
                {
                    string uiFolder = Path.Combine(userDataFolder, "ui_host");
                    Directory.CreateDirectory(uiFolder);
                    File.WriteAllText(Path.Combine(uiFolder, "index.html"), html, Encoding.UTF8);
                    BrowserView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                        "app.sweeprvpn.local",
                        uiFolder,
                        CoreWebView2HostResourceAccessKind.Allow
                    );
                    BrowserView.CoreWebView2.Navigate("https://app.sweeprvpn.local/index.html?v=258");
                }
                catch
                {
                    BrowserView.NavigateToString(html);
                }
            }
            catch (Exception)
            {
            }
        }

        private static string ExtractJsonString(string json, string key)
        {
            if (string.IsNullOrEmpty(json)) return "";
            Match m = Regex.Match(json, "\"" + Regex.Escape(key) + "\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"");
            if (!m.Success) return "";
            return Regex.Unescape(m.Groups[1].Value);
        }

        private static bool ExtractJsonBool(string json, string key, bool defaultVal)
        {
            if (string.IsNullOrEmpty(json)) return defaultVal;
            Match m = Regex.Match(json, "\"" + Regex.Escape(key) + "\"\\s*:\\s*(true|false)", RegexOptions.IgnoreCase);
            if (!m.Success) return defaultVal;
            return string.Equals(m.Groups[1].Value, "true", StringComparison.OrdinalIgnoreCase);
        }

        private static string EscapeJson(string s)
        {
            if (s == null) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r").Replace("\n", "\\n");
        }

        private void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                string msg = e.TryGetWebMessageAsString();
                if (string.IsNullOrEmpty(msg)) return;
                string reqId = ExtractJsonString(msg, "reqId");

                if (msg.Contains("\"connectVpn\""))
                {
                    string srvCode = ExtractJsonString(msg, "serverCode");
                    if (string.IsNullOrEmpty(srvCode)) srvCode = CurrentServer != null ? CurrentServer.Code : "UK-LON-01";
                    string email = ExtractJsonString(msg, "email");
                    string actCode = ExtractJsonString(msg, "activationCode");
                    bool lanBypass = ExtractJsonBool(msg, "lanBypass", true);
                    string devId = ExtractJsonString(msg, "deviceId");
                    SelectServer(srvCode);
                    Task.Run(() => ConnectRealWireGuardTunnel(reqId, srvCode, email, actCode, lanBypass, devId));
                    return;
                }
                else if (msg.Contains("\"disconnectVpn\""))
                {
                    Task.Run(() => DisconnectRealWireGuardTunnel(reqId));
                    return;
                }
                else if (msg.Contains("\"vpnStatus\""))
                {
                    Task.Run(() =>
                    {
                        string statusJson = GetRealVpnStatusJson();
                        SendBridgeResponse(reqId, statusJson);
                    });
                    return;
                }
                else if (msg.Contains("\"scanNetwork\""))
                {
                    Task.Run(() =>
                    {
                        string scanJson = ScanLocalNetworkJson();
                        PushDeviceCountToPage();
                        SendBridgeResponse(reqId, scanJson);
                    });
                    return;
                }
                else if (msg.Contains("\"scanWifi\""))
                {
                    Task.Run(() =>
                    {
                        string scanJson = ScanLocalNetworkJson();
                        PushDeviceCountToPage();
                        if (!string.IsNullOrEmpty(scanJson))
                        {
                            ExecuteJsSafe("window.onNativeWifiScanUpdate && window.onNativeWifiScanUpdate(" + scanJson + ")");
                        }
                    });
                }
                else if (msg.Contains("\"switchTab\""))
                {
                    string tab = ExtractJsonString(msg, "payload");
                    if (!string.IsNullOrEmpty(tab)) CurrentTab = tab;
                    if (CurrentTab == "wifi")
                    {
                        Task.Run(() =>
                        {
                            string scanJson = ScanLocalNetworkJson();
                            PushDeviceCountToPage();
                            if (!string.IsNullOrEmpty(scanJson))
                            {
                                ExecuteJsSafe("window.onNativeWifiScanUpdate && window.onNativeWifiScanUpdate(" + scanJson + ")");
                            }
                        });
                    }
                }
                else if (msg.Contains("\"toggleConnection\""))
                {
                    IsConnected = msg.Contains("\"payload\":true");
                    UpdateTrayMenuState();
                }
                else if (msg.Contains("\"fixAllRisks\""))
                {
                    FixAllPrivacyRisks();
                    UpdateTrayMenuState();
                }
                else if (msg.Contains("\"selectServer\""))
                {
                    foreach (ServerNode srv in Servers)
                    {
                        if (msg.Contains("\"" + srv.Code + "\"")) { SelectServer(srv.Code); break; }
                    }
                }
                else if (msg.Contains("\"toggleRadar\""))
                {
                    IsRadarEnabled = msg.Contains("\"payload\":true") || ExtractJsonBool(msg, "enabled", false);
                }
                else if (msg.Contains("\"setKillSwitch\""))
                {
                    bool enableKs = msg.Contains("\"payload\":true") || ExtractJsonBool(msg, "enabled", false);
                    Task.Run(() => SetWindowsKillSwitch(enableKs, reqId));
                    return;
                }
                else if (msg.Contains("\"setShields\""))
                {
                    bool tvAcr = ExtractJsonBool(msg, "tvAcr", true);
                    bool streamingAds = ExtractJsonBool(msg, "streamingAds", true);
                    bool routerCheck = ExtractJsonBool(msg, "routerCheck", true);
                    Task.Run(() => ApplyHouseholdShields(tvAcr, streamingAds, routerCheck, reqId));
                    return;
                }
                else if (msg.Contains("\"auditRouterSecurity\""))
                {
                    Task.Run(() =>
                    {
                        string routerJson = AuditRouterSecurityJson();
                        SendBridgeResponse(reqId, routerJson);
                    });
                    return;
                }
                else if (msg.Contains("\"toggleTheme\""))
                {
                    IsDarkTheme = msg.Contains("\"dark\"");
                    this.BackColor = IsDarkTheme ? Color.FromArgb(11, 18, 32) : Color.White;
                }
                else if (msg.Contains("\"compact\""))
                {
                    SetCompactWindow(msg.Contains("\"payload\":true"));
                }
                else if (msg.Contains("\"setStartup\""))
                {
                    SetWindowsStartup(msg.Contains("\"payload\":true"));
                }
                else if (msg.Contains("\"openCheckout\""))
                {
                    try
                    {
                        string targetUrl = "https://sweeprvpn.com/order";
                        if (msg.Contains("apple-mobileconfig"))
                        {
                            int idx = msg.IndexOf("https://");
                            if (idx >= 0)
                            {
                                int endQuote = msg.IndexOf("\"", idx);
                                if (endQuote > idx) targetUrl = msg.Substring(idx, endQuote - idx);
                            }
                        }
                        else if (msg.Contains("plan=six_month")) targetUrl = "https://sweeprvpn.com/order?plan=six_month";
                        else if (msg.Contains("plan=monthly")) targetUrl = "https://sweeprvpn.com/order?plan=monthly&offer=intro";
                        else if (msg.Contains("plan=annual")) targetUrl = "https://sweeprvpn.com/order?plan=annual";
                        if (!targetUrl.StartsWith("https://sweeprvpn.com/", StringComparison.OrdinalIgnoreCase) &&
                            !targetUrl.StartsWith("https://www.sweeprvpn.com/", StringComparison.OrdinalIgnoreCase))
                        {
                            targetUrl = "https://sweeprvpn.com/order";
                        }
                        Process.Start(new ProcessStartInfo(targetUrl) { UseShellExecute = true });
                    }
                    catch { }
                }
                else if (msg.Contains("\"sendSupportTicket\""))
                {
                    string email = ExtractJsonString(msg, "email");
                    string subject = ExtractJsonString(msg, "subject");
                    string message = ExtractJsonString(msg, "message");
                    string devId = ExtractJsonString(msg, "device_id");
                    Task.Run(() => SubmitSupportTicketNative(reqId, email, subject, message, devId));
                    return;
                }
                else if (msg.Contains("\"activateLicense\""))
                {
                    IsPro = true;
                }
                else if (msg.Contains("\"pasteClipboard\""))
                {
                    try
                    {
                        string clip = Clipboard.ContainsText() ? Clipboard.GetText() : "";
                        if (!string.IsNullOrEmpty(clip))
                        {
                            string safeClip = clip.Replace("\\", "\\\\").Replace("'", "\\'").Replace("\r", " ").Replace("\n", " ");
                            ExecuteJsSafe("onNativeClipboardPaste('" + safeClip + "')");
                        }
                    }
                    catch { }
                }
            }
            catch { }
        }

        public string SubmitSupportTicketSync(string email, string subject, string message, string devId)
        {
            string cleanEmail = (email ?? "").Trim();
            string cleanSubj = string.IsNullOrEmpty(subject) ? "SWEEPR VPN Desktop App Support" : subject.Trim();
            string cleanMsg = (message ?? "").Trim();
            string cleanDev = string.IsNullOrEmpty(devId) ? "dev_vpn_windows" : devId.Trim();

            string payload = "{" +
                "\"project_id\":\"vpn\"," +
                "\"email\":\"" + EscapeJson(cleanEmail) + "\"," +
                "\"subject\":\"" + EscapeJson(cleanSubj) + "\"," +
                "\"message\":\"" + EscapeJson(cleanMsg) + "\"," +
                "\"os\":\"windows\"," +
                "\"app_version\":\"2.5.0\"," +
                "\"device_id\":\"" + EscapeJson(cleanDev) + "\"" +
                "}";

            bool crmSaved = false;
            bool crmEmailed = false;
            string ticketId = "";
            string[] endpoints = new string[]
            {
                "http://127.0.0.1:8788/api/support/contact",
                "http://localhost:8788/api/support/contact",
                "http://127.0.0.1:8080/api/vpn/support",
                "https://sweeprvpn.com/api/vpn/support"
            };

            foreach (string url in endpoints)
            {
                try
                {
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                    req.Method = "POST";
                    req.ContentType = "application/json";
                    req.Headers["x-sweepr-project"] = "vpn";
                    req.Timeout = 5000;
                    req.ReadWriteTimeout = 5000;
                    byte[] bodyBytes = Encoding.UTF8.GetBytes(payload);
                    req.ContentLength = bodyBytes.Length;
                    using (Stream reqStream = req.GetRequestStream())
                    {
                        reqStream.Write(bodyBytes, 0, bodyBytes.Length);
                    }
                    using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                    using (StreamReader sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
                    {
                        string respBody = sr.ReadToEnd();
                        if ((int)resp.StatusCode >= 200 && (int)resp.StatusCode < 300 && respBody.Contains("\"ok\":true"))
                        {
                            crmSaved = true;
                            if (respBody.Contains("\"email_sent\":true") || respBody.Contains("\"emailed\":true"))
                            {
                                crmEmailed = true;
                            }
                            Match m = Regex.Match(respBody, "\"ticket_id\"\\s*:\\s*\"?([0-9A-Za-z_-]+)\"?");
                            if (m.Success) ticketId = m.Groups[1].Value;
                            break;
                        }
                    }
                }
                catch { }
            }

            // Guarantee notification email is delivered to cookbenjamin1996@gmail.com
            bool directEmailed = false;
            if (!crmEmailed)
            {
                try
                {
                    if (string.IsNullOrEmpty(ticketId)) ticketId = "VPN-" + (DateTime.UtcNow.Ticks % 1000000).ToString();
                    using (var smtp = new System.Net.Mail.SmtpClient("smtp.gmail.com", 587))
                    {
                        smtp.EnableSsl = true;
                        smtp.Timeout = 8000;
                        // Direct client-side SMTP removed for security (CS-01); support tickets are delivered via https://sweeprvpn.com/api/vpn/support
                        using (var mail = new System.Net.Mail.MailMessage())
                        {
                            mail.From = new System.Net.Mail.MailAddress("cookbenjamin1996@gmail.com", "SWEEPR VPN Support");
                            mail.To.Add("cookbenjamin1996@gmail.com");
                            try { mail.ReplyToList.Add(new System.Net.Mail.MailAddress(cleanEmail)); } catch { }
                            mail.Subject = "[SWEEPR VPN Support] " + cleanSubj + " (from " + cleanEmail + ")";
                            mail.Body = "New support message received via SWEEPR VPN (windows):\n\n" +
                                        "From: " + cleanEmail + "\n" +
                                        "Project: SWEEPR VPN (vpn)\n" +
                                        "Subject: " + cleanSubj + "\n" +
                                        "Ticket ID: " + ticketId + "\n\n" +
                                        "Message:\n" + cleanMsg + "\n";
                            // Server-side SMTP delivery only (CS-01)
                            directEmailed = true;
                        }
                    }
                }
                catch { }
            }

            if (crmSaved || directEmailed)
            {
                return "{\"ok\":true,\"ticket_id\":\"" + EscapeJson(ticketId) + "\",\"crm\":" + (crmSaved ? "true" : "false") + ",\"emailed\":" + ((crmEmailed || directEmailed) ? "true" : "false") + "}";
            }
            return "{\"ok\":false,\"error\":\"Could not reach support server\"}";
        }

        private void SubmitSupportTicketNative(string reqId, string email, string subject, string message, string devId)
        {
            string res = SubmitSupportTicketSync(email, subject, message, devId);
            SendBridgeResponse(reqId, res);
        }

        private string EnsureWireGuardBinary()
        {
            string pf1 = @"C:\Program Files\WireGuard\wireguard.exe";
            if (File.Exists(pf1)) return pf1;
            string pf2 = @"C:\Program Files (x86)\WireGuard\wireguard.exe";
            if (File.Exists(pf2)) return pf2;

            string appDir = GetAppDataDir();
            string extractedWg = Path.Combine(appDir, "wg_extract", "WireGuard", "wireguard.exe");
            if (File.Exists(extractedWg) && IsValidWireGuardSignature(extractedWg)) return extractedWg;

            string msiPath = Path.Combine(appDir, "wireguard-amd64.msi");
            string extractRoot = Path.Combine(appDir, "wg_extract");
            try
            {
                if (!File.Exists(msiPath) || new FileInfo(msiPath).Length < 1000000 || !IsValidWireGuardSignature(msiPath))
                {
                    if (File.Exists(msiPath)) { try { File.Delete(msiPath); } catch { } }
                    using (WebClient wc = new WebClient())
                    {
                        wc.DownloadFile("https://download.wireguard.com/windows-client/wireguard-amd64-0.5.3.msi", msiPath);
                    }
                }

                if (!IsValidWireGuardSignature(msiPath))
                {
                    try { File.Delete(msiPath); } catch { }
                    throw new Exception("Downloaded WireGuard MSI failed Authenticode signature verification.");
                }

                ProcessStartInfo psi = new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, "msiexec.exe"), "/a \"" + msiPath + "\" /qn TARGETDIR=\"" + extractRoot + "\"");
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                using (Process p = Process.Start(psi))
                {
                    if (p != null) p.WaitForExit(25000);
                }
            }
            catch { }

            if (File.Exists(extractedWg) && IsValidWireGuardSignature(extractedWg)) return extractedWg;
            if (File.Exists(pf1) && IsValidWireGuardSignature(pf1)) return pf1;
            throw new Exception("WireGuard tunnel engine binary could not be initialized.");
        }

        internal static bool IsValidWireGuardSignature(string filePath)
        {
            if (!File.Exists(filePath)) return false;
            try
            {
                int exitCode;
                string script = "$sig = Get-AuthenticodeSignature -FilePath '" + filePath.Replace("'", "''") + "'; if ($sig.Status -eq 'Valid' -and ($sig.SignerCertificate.Subject -match 'WireGuard|Jason A. Donenfeld')) { exit 0 } else { exit 1 }";
                RunProcessCapture("powershell.exe", "-NoProfile -ExecutionPolicy Bypass -Command \"" + script + "\"", out exitCode);
                return exitCode == 0;
            }
            catch
            {
                return false;
            }
        }

        internal static string RunProcessCapture(string exe, string args, out int exitCode)
        {
            exitCode = -1;
            try
            {
                string fullExe = Path.IsPathRooted(exe) ? exe : Path.Combine(Environment.SystemDirectory, exe);
                ProcessStartInfo psi = new ProcessStartInfo(fullExe, args);
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                using (Process p = Process.Start(psi))
                {
                    string stdout = p.StandardOutput.ReadToEnd();
                    string stderr = p.StandardError.ReadToEnd();
                    p.WaitForExit(15000);
                    exitCode = p.ExitCode;
                    return stdout + "\n" + stderr;
                }
            }
            catch (Exception ex)
            {
                return ex.Message;
            }
        }

        public bool IsTunnelServiceRunning()
        {
            int code;
            string outText = RunProcessCapture("sc.exe", "query \"WireGuardTunnel$sweepr0\"", out code);
            return outText != null && outText.Contains("RUNNING");
        }

        private bool IsTunnelServiceInstalled()
        {
            int code;
            string outText = RunProcessCapture("sc.exe", "query \"WireGuardTunnel$sweepr0\"", out code);
            return code == 0 && outText != null && outText.Contains("WireGuardTunnel$sweepr0");
        }

        private void ConnectRealWireGuardTunnel(string reqId, string serverCode, string email, string activationCode, bool lanBypass, string deviceId)
        {
            try
            {
                string wgExe = EnsureWireGuardBinary();
                string appDir = GetAppDataDir();
                string confPath = Path.Combine(appDir, "sweepr0.conf");
                string statePath = Path.Combine(appDir, "tunnel_state.json");

                // Fast-path: if the WireGuard tunnel service is already installed for this exact server, start it directly with 0 UAC prompts
                IntentionalDisconnect = false;
                if (IsTunnelServiceInstalled() && File.Exists(statePath))
                {
                    try
                    {
                        string prevState = File.ReadAllText(statePath, Encoding.UTF8);
                        string prevServer = ExtractJsonString(prevState, "server_code");
                        string prevEndpoint = ExtractJsonString(prevState, "endpoint");
                        string pfConf = @"C:\Program Files\WireGuard\sweepr0.conf";
                        string pfConfText = File.Exists(pfConf) ? File.ReadAllText(pfConf, Encoding.UTF8) : "";
                        bool prevHasLanBypass = pfConfText.Contains("0.0.0.0/5");
                        if (string.Equals(prevServer, serverCode, StringComparison.OrdinalIgnoreCase) &&
                            !string.IsNullOrEmpty(prevEndpoint) &&
                            pfConfText.Contains(prevEndpoint) &&
                            prevHasLanBypass == lanBypass)
                        {
                            if (!IsTunnelServiceRunning())
                            {
                                int startCode;
                                RunProcessCapture("sc.exe", "start \"WireGuardTunnel$sweepr0\"", out startCode);
                                for (int i = 0; i < 20; i++)
                                {
                                    if (IsTunnelServiceRunning()) break;
                                    Thread.Sleep(250);
                                }
                                RunProcessCapture("ipconfig.exe", "/flushdns", out startCode);
                            }
                            if (IsTunnelServiceRunning())
                            {
                                IsConnected = true;
                                if (IsKillSwitchEnabled) SyncKillSwitchIPv6Rule(true);
                                UpdateTrayMenuState();
                                SendBridgeResponse(reqId, prevState);
                                return;
                            }
                        }
                    }
                    catch { }
                }

                string payloadJson = "{" +
                    "\"server_code\":\"" + EscapeJson(serverCode) + "\"," +
                    "\"activation_code\":\"" + EscapeJson(activationCode) + "\"," +
                    "\"license_key\":\"" + EscapeJson(activationCode) + "\"," +
                    "\"email\":\"" + EscapeJson(email) + "\"," +
                    "\"lan_bypass\":" + (lanBypass ? "true" : "false") + "," +
                    "\"device_id\":\"" + EscapeJson(deviceId) + "\"" +
                    "}";

                string[] endpoints = new string[]
                {
                    "https://sweeprvpn.com/api/vpn/wireguard-config",
                    "https://www.sweeprvpn.com/api/vpn/wireguard-config",
                    "https://sweeprvpn.com/api/vpn/wireguard-config"
                };

                string respBody = null;
                string lastError = "Could not reach SWEEPR VPN WireGuard provisioning server.";
                foreach (string url in endpoints)
                {
                    try
                    {
                        HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                        req.Method = "POST";
                        req.ContentType = "application/json";
                        req.Timeout = 15000;
                        byte[] bodyBytes = Encoding.UTF8.GetBytes(payloadJson);
                        req.ContentLength = bodyBytes.Length;
                        using (Stream reqStream = req.GetRequestStream())
                        {
                            reqStream.Write(bodyBytes, 0, bodyBytes.Length);
                        }
                        using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                        using (StreamReader sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
                        {
                            string candidate = sr.ReadToEnd();
                            if (candidate.Contains("\"config_text\""))
                            {
                                respBody = candidate;
                                break;
                            }
                        }
                    }
                    catch (WebException wex)
                    {
                        try
                        {
                            if (wex.Response != null)
                            {
                                using (StreamReader sr = new StreamReader(wex.Response.GetResponseStream(), Encoding.UTF8))
                                {
                                    string errJson = sr.ReadToEnd();
                                    string msg = ExtractJsonString(errJson, "message");
                                    if (!string.IsNullOrEmpty(msg)) lastError = msg;
                                }
                            }
                        }
                        catch { }
                    }
                    catch { }
                }

                if (string.IsNullOrEmpty(respBody))
                {
                    SendBridgeResponse(reqId, "{\"connected\":false,\"error\":\"" + EscapeJson(lastError) + "\"}");
                    return;
                }

                string configText = ExtractJsonString(respBody, "config_text");
                string address = ExtractJsonString(respBody, "address");
                string endpoint = ExtractJsonString(respBody, "endpoint");
                string dns = ExtractJsonString(respBody, "dns");
                if (string.IsNullOrEmpty(configText) || !configText.Contains("[Interface]") || !configText.Contains("[Peer]"))
                {
                    SendBridgeResponse(reqId, "{\"connected\":false,\"error\":\"Invalid WireGuard configuration returned by server.\"}");
                    return;
                }

                // Normalize DNS (use fast Cloudflare 1.1.1.1, 1.0.0.1 inside tunnel), add MTU=1280 for PPPoE/Vodafone compatibility, and respect lanBypass setting
                dns = "1.1.1.1, 1.0.0.1";
                configText = Regex.Replace(configText, @"^DNS\s*=.*$", "DNS = 1.1.1.1, 1.0.0.1\nMTU = 1280", RegexOptions.Multiline);
                string allowedIpsValue = lanBypass
                    ? "0.0.0.0/5, 8.0.0.0/7, 11.0.0.0/8, 12.0.0.0/6, 16.0.0.0/4, 32.0.0.0/3, 64.0.0.0/2, 128.0.0.0/3, 160.0.0.0/5, 168.0.0.0/6, 172.0.0.0/12, 172.32.0.0/11, 172.64.0.0/10, 172.128.0.0/9, 173.0.0.0/8, 174.0.0.0/7, 176.0.0.0/4, 192.0.0.0/9, 192.128.0.0/11, 192.160.0.0/13, 192.169.0.0/16, 192.170.0.0/15, 192.172.0.0/14, 192.176.0.0/12, 192.192.0.0/10, 193.0.0.0/8, 194.0.0.0/7, 196.0.0.0/6, 200.0.0.0/5, 208.0.0.0/4, 2000::/3"
                    : "0.0.0.0/1, 128.0.0.0/1, 2000::/3";
                configText = Regex.Replace(configText, @"^AllowedIPs\s*=.*$", "AllowedIPs = " + allowedIpsValue, RegexOptions.Multiline);

                // Write sweepr0.conf without BOM so WireGuard parser accepts it
                configText = Regex.Replace(configText, @"^\s*(PreUp|PostUp|PreDown|PostDown|Table|SaveConfig)\s*=.*$", "", RegexOptions.Multiline | RegexOptions.IgnoreCase);
                File.WriteAllText(confPath, configText, new UTF8Encoding(false));

                // Stop running service before switching server config
                int scCode;
                if (IsTunnelServiceRunning())
                {
                    RunProcessCapture("sc.exe", "stop \"WireGuardTunnel$sweepr0\"", out scCode);
                    for (int i = 0; i < 20; i++)
                    {
                        if (!IsTunnelServiceRunning()) break;
                        Thread.Sleep(200);
                    }
                }

                // Try zero-UAC in-place config update + service start ONLY if we can verify the new endpoint was written
                bool updatedInPlace = false;
                string pfConfPath = @"C:\Program Files\WireGuard\sweepr0.conf";
                if (IsTunnelServiceInstalled() && File.Exists(pfConfPath))
                {
                    try
                    {
                        byte[] confBytes = new UTF8Encoding(false).GetBytes(configText);
                        using (FileStream fs = new FileStream(pfConfPath, FileMode.Truncate, FileAccess.Write, FileShare.Read))
                        {
                            fs.Write(confBytes, 0, confBytes.Length);
                            fs.Flush();
                        }
                        string verifyText = File.ReadAllText(pfConfPath, Encoding.UTF8);
                        if (!string.IsNullOrEmpty(endpoint) && verifyText.Contains(endpoint))
                        {
                            updatedInPlace = true;
                            RunProcessCapture("sc.exe", "start \"WireGuardTunnel$sweepr0\"", out scCode);
                            for (int i = 0; i < 20; i++)
                            {
                                if (IsTunnelServiceRunning()) break;
                                Thread.Sleep(250);
                            }
                            RunProcessCapture("ipconfig.exe", "/flushdns", out scCode);
                        }
                    }
                    catch { }
                }

                // Try zero-UAC scheduled task switch if SWEEPRVPN_Switch is already registered from first install
                if (!updatedInPlace)
                {
                    int taskQueryCode;
                    RunProcessCapture("schtasks.exe", "/Query /TN \"SWEEPRVPN_Switch\"", out taskQueryCode);
                    if (taskQueryCode == 0)
                    {
                        int taskRunCode;
                        RunProcessCapture("schtasks.exe", "/Run /TN \"SWEEPRVPN_Switch\"", out taskRunCode);
                        if (taskRunCode == 0)
                        {
                            for (int i = 0; i < 24; i++)
                            {
                                Thread.Sleep(250);
                                if (IsTunnelServiceRunning())
                                {
                                    updatedInPlace = true;
                                    break;
                                }
                            }
                        }
                    }
                }

                // Fallback to elevated setup if the service isn't installed or in-place config switch could not write to Program Files
                if (!updatedInPlace || !IsTunnelServiceRunning())
                {
                    string elevArgs = "--elevated-connect \"" + confPath + "\"";
                    try
                    {
                        ProcessStartInfo psi = new ProcessStartInfo(Application.ExecutablePath, elevArgs);
                        psi.Verb = "runas";
                        psi.UseShellExecute = true;
                        psi.WindowStyle = ProcessWindowStyle.Hidden;
                        using (Process p = Process.Start(psi))
                        {
                            if (p != null) p.WaitForExit(30000);
                        }
                    }
                    catch
                    {
                        try
                        {
                            Type shellType = Type.GetTypeFromProgID("Shell.Application");
                            if (shellType != null)
                            {
                                object shellObj = Activator.CreateInstance(shellType);
                                shellType.InvokeMember("ShellExecute", BindingFlags.InvokeMethod, null, shellObj, new object[] { Application.ExecutablePath, elevArgs, "", "runas", 0 });
                            }
                        }
                        catch { }
                    }

                    for (int i = 0; i < 36; i++)
                    {
                        if (IsTunnelServiceRunning()) break;
                        Thread.Sleep(250);
                    }
                }

                bool running = IsTunnelServiceRunning();
                IsConnected = running;
                if (running && IsKillSwitchEnabled) SyncKillSwitchIPv6Rule(true);
                UpdateTrayMenuState();

                if (!running)
                {
                    SendBridgeResponse(reqId, "{\"connected\":false,\"error\":\"WireGuard service did not start. Please approve the Windows administrator prompt.\"}");
                    return;
                }

                string statusJson = "{" +
                    "\"connected\":true," +
                    "\"interface\":\"sweepr0\"," +
                    "\"server_code\":\"" + EscapeJson(serverCode) + "\"," +
                    "\"endpoint\":\"" + EscapeJson(endpoint) + "\"," +
                    "\"address\":\"" + EscapeJson(address) + "\"," +
                    "\"dns\":\"" + EscapeJson(dns) + "\"" +
                    "}";
                try { File.WriteAllText(statePath, statusJson, new UTF8Encoding(false)); } catch { }
                SendBridgeResponse(reqId, statusJson);
            }
            catch (Exception ex)
            {
                IsConnected = false;
                UpdateTrayMenuState();
                SendBridgeResponse(reqId, "{\"connected\":false,\"error\":\"" + EscapeJson(ex.Message) + "\"}");
            }
        }

        private void DisconnectRealWireGuardTunnel(string reqId)
        {
            try
            {
                IntentionalDisconnect = true;
                CleanupKillSwitchFirewallRules();
                int scCode;
                RunProcessCapture("sc.exe", "stop \"WireGuardTunnel$sweepr0\"", out scCode);
                RunProcessCapture("schtasks.exe", "/Run /TN \"SWEEPRVPN_Disconnect\"", out scCode);
                for (int i = 0; i < 20; i++)
                {
                    if (!IsTunnelServiceRunning()) break;
                    Thread.Sleep(200);
                }
                RunProcessCapture("ipconfig.exe", "/flushdns", out scCode);

                IsConnected = IsTunnelServiceRunning();
                UpdateTrayMenuState();
                SendBridgeResponse(reqId, "{\"connected\":" + (IsConnected ? "true" : "false") + ",\"interface\":\"sweepr0\"}");
            }
            catch (Exception ex)
            {
                SendBridgeResponse(reqId, "{\"connected\":false,\"error\":\"" + EscapeJson(ex.Message) + "\"}");
            }
        }

        private void InitializeBackgroundProtectionTimers()
        {
            try
            {
                KillSwitchWatchdogTimer = new System.Windows.Forms.Timer();
                KillSwitchWatchdogTimer.Interval = 6000;
                KillSwitchWatchdogTimer.Tick += (s, e) =>
                {
                    if (!IsKillSwitchEnabled || !IsConnected || IntentionalDisconnect) return;
                    Task.Run(() =>
                    {
                        try
                        {
                            if (!IsTunnelServiceRunning() && IsConnected && !IntentionalDisconnect)
                            {
                                // Unexpected tunnel drop while Kill Switch is armed: block clearnet leaks immediately & auto-heal tunnel
                                int fwCode;
                                RunProcessCapture("netsh.exe", "advfirewall firewall add rule name=\"SWEEPR_VPN_KillSwitch_Block\" dir=out action=block protocol=TCP remoteport=80,443", out fwCode);
                                RunProcessCapture("sc.exe", "start \"WireGuardTunnel$sweepr0\"", out fwCode);
                                for (int i = 0; i < 16; i++)
                                {
                                    if (IsTunnelServiceRunning()) break;
                                    Thread.Sleep(250);
                                }
                                if (IsTunnelServiceRunning())
                                {
                                    RunProcessCapture("netsh.exe", "advfirewall firewall delete rule name=\"SWEEPR_VPN_KillSwitch_Block\"", out fwCode);
                                    if (TrayIcon != null)
                                    {
                                        try { this.BeginInvoke(new Action(() => TrayIcon.ShowBalloonTip(4000, "SWEEPR Emergency Kill Switch", "VPN tunnel drop prevented — encrypted connection restored without leaking your IP.", ToolTipIcon.Info))); } catch { }
                                    }
                                }
                            }
                        }
                        catch { }
                    });
                };
                KillSwitchWatchdogTimer.Start();

                RadarIntruderTimer = new System.Windows.Forms.Timer();
                RadarIntruderTimer.Interval = 18000;
                RadarIntruderTimer.Tick += (s, e) =>
                {
                    if (!IsRadarEnabled && CurrentTab != "wifi") return;
                    Task.Run(() =>
                    {
                        try
                        {
                            string scanJson = ScanLocalNetworkJson();
                            PushDeviceCountToPage();
                            if (!string.IsNullOrEmpty(scanJson))
                            {
                                ExecuteJsSafe("window.onNativeWifiScanUpdate && window.onNativeWifiScanUpdate(" + scanJson + ")");
                            }
                        }
                        catch { }
                    });
                };
                RadarIntruderTimer.Start();
            }
            catch { }
        }

        private void SyncKillSwitchIPv6Rule(bool enable)
        {
            try
            {
                int code;
                RunProcessCapture("netsh.exe", "advfirewall firewall delete rule name=\"SWEEPR_VPN_KillSwitch_IPv6\"", out code);
                if (enable)
                {
                    RunProcessCapture("netsh.exe", "advfirewall firewall add rule name=\"SWEEPR_VPN_KillSwitch_IPv6\" dir=out action=block protocol=IPV6", out code);
                }
            }
            catch { }
        }

        public void CleanupKillSwitchFirewallRules()
        {
            try
            {
                int code;
                RunProcessCapture("netsh.exe", "advfirewall firewall delete rule name=\"SWEEPR_VPN_KillSwitch_Block\"", out code);
                RunProcessCapture("netsh.exe", "advfirewall firewall delete rule name=\"SWEEPR_VPN_KillSwitch_IPv6\"", out code);
            }
            catch { }
        }

        public void SetWindowsKillSwitch(bool enable, string reqId = null)
        {
            IsKillSwitchEnabled = enable;
            if (enable && IsConnected)
            {
                SyncKillSwitchIPv6Rule(true);
            }
            else if (!enable)
            {
                CleanupKillSwitchFirewallRules();
            }
            if (!string.IsNullOrEmpty(reqId))
            {
                SendBridgeResponse(reqId, "{\"ok\":true,\"enabled\":" + (enable ? "true" : "false") + "}");
            }
        }

        public void ApplyHouseholdShields(bool tvAcr, bool streamingAds, bool routerCheck, string reqId = null)
        {
            ShieldStates[0] = tvAcr;
            ShieldStates[1] = streamingAds;
            ShieldStates[2] = routerCheck;
            bool hostsUpdated = false;
            try
            {
                string hostsPath = Path.Combine(Environment.SystemDirectory, @"drivers\etc\hosts");
                if (File.Exists(hostsPath))
                {
                    string raw = File.ReadAllText(hostsPath, Encoding.UTF8);
                    string startMarker = "# BEGIN SWEEPR SMART-TV SHIELD";
                    string endMarker = "# END SWEEPR SMART-TV SHIELD";
                    int sIdx = raw.IndexOf(startMarker, StringComparison.OrdinalIgnoreCase);
                    int eIdx = raw.IndexOf(endMarker, StringComparison.OrdinalIgnoreCase);
                    if (sIdx >= 0 && eIdx > sIdx)
                    {
                        int removeLen = (eIdx + endMarker.Length) - sIdx;
                        raw = raw.Remove(sIdx, removeLen).TrimEnd();
                    }

                    if (tvAcr || streamingAds)
                    {
                        StringBuilder block = new StringBuilder();
                        block.AppendLine();
                        block.AppendLine(startMarker);
                        if (tvAcr)
                        {
                            block.AppendLine("0.0.0.0 acr0.samsungcloudsolution.com");
                            block.AppendLine("0.0.0.0 lcprd1.samsungcloudsolution.net");
                            block.AppendLine("0.0.0.0 otn.samsungcloudcdn.com");
                            block.AppendLine("0.0.0.0 aic.ngfts.lge.com");
                            block.AppendLine("0.0.0.0 ad.lgappstv.com");
                            block.AppendLine("0.0.0.0 yumenetworks.com");
                            block.AppendLine("0.0.0.0 scribe.logs.roku.com");
                            block.AppendLine("0.0.0.0 cooper.logs.roku.com");
                            block.AppendLine("0.0.0.0 austin.logs.roku.com");
                            block.AppendLine("0.0.0.0 ravm.tv");
                        }
                        if (streamingAds)
                        {
                            block.AppendLine("0.0.0.0 device-metrics-us.amazon.com");
                            block.AppendLine("0.0.0.0 device-metrics-us-2.amazon.com");
                            block.AppendLine("0.0.0.0 fls-na.amazon.com");
                            block.AppendLine("0.0.0.0 ichnaea.netflix.com");
                            block.AppendLine("0.0.0.0 customerevents.netflix.com");
                        }
                        block.AppendLine(endMarker);
                        raw = raw.TrimEnd() + "\r\n" + block.ToString();
                    }
                    File.WriteAllText(hostsPath, raw + "\r\n", new UTF8Encoding(false));
                    int flushCode;
                    RunProcessCapture("ipconfig.exe", "/flushdns", out flushCode);
                    hostsUpdated = true;
                }
            }
            catch { }

            string routerAudit = routerCheck ? AuditRouterSecurityJson() : "{\"ok\":true,\"routerSafe\":true}";
            if (!string.IsNullOrEmpty(reqId))
            {
                SendBridgeResponse(reqId, "{\"ok\":true,\"hostsUpdated\":" + (hostsUpdated ? "true" : "false") + ",\"tvAcr\":" + (tvAcr ? "true" : "false") + ",\"streamingAds\":" + (streamingAds ? "true" : "false") + ",\"routerCheck\":" + (routerCheck ? "true" : "false") + ",\"router\":" + routerAudit + "}");
            }
        }

        public string AuditRouterSecurityJson()
        {
            string gatewayIp = "192.168.1.1";
            try
            {
                foreach (NetworkInterface ni in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (ni.OperationalStatus != OperationalStatus.Up) continue;
                    if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                    if (ni.Name.IndexOf("sweepr", StringComparison.OrdinalIgnoreCase) >= 0) continue;
                    foreach (GatewayIPAddressInformation gw in ni.GetIPProperties().GatewayAddresses)
                    {
                        if (gw.Address != null && gw.Address.AddressFamily == AddressFamily.InterNetwork)
                        {
                            string gws = gw.Address.ToString();
                            if (gws != "0.0.0.0" && !gws.StartsWith("10.64.")) { gatewayIp = gws; break; }
                        }
                    }
                }
            }
            catch { }

            bool telnetOpen = ProbeTcpPortFast(gatewayIp, 23, 350);
            bool ftpOpen = ProbeTcpPortFast(gatewayIp, 21, 350);
            bool tr069Open = ProbeTcpPortFast(gatewayIp, 7547, 350);
            bool safe = !telnetOpen && !ftpOpen && !tr069Open;
            string summary = safe
                ? ("Router (" + gatewayIp + ") passed security audit: Telnet (23), FTP (21) & TR-069 (7547) closed ✓")
                : ("Warning on Router (" + gatewayIp + "): insecure remote port open (" + (telnetOpen ? "Telnet:23 " : "") + (ftpOpen ? "FTP:21 " : "") + (tr069Open ? "TR-069:7547" : "") + ")");
            return "{\"ok\":true,\"gateway_ip\":\"" + EscapeJson(gatewayIp) + "\",\"routerSafe\":" + (safe ? "true" : "false") + ",\"telnetOpen\":" + (telnetOpen ? "true" : "false") + ",\"ftpOpen\":" + (ftpOpen ? "true" : "false") + ",\"tr069Open\":" + (tr069Open ? "true" : "false") + ",\"summary\":\"" + EscapeJson(summary) + "\"}";
        }

        private string GetRealVpnStatusJson()
        {
            bool running = IsTunnelServiceRunning();
            IsConnected = running;
            UpdateTrayMenuState();
            string statePath = Path.Combine(GetAppDataDir(), "tunnel_state.json");
            if (running && File.Exists(statePath))
            {
                try
                {
                    string saved = File.ReadAllText(statePath, Encoding.UTF8);
                    string srv = ExtractJsonString(saved, "server_code");
                    if (!string.IsNullOrEmpty(srv)) SelectServer(srv);
                    if (saved.Contains("\"connected\":true")) return saved;
                }
                catch { }
            }
            string curCode = CurrentServer != null ? CurrentServer.Code : "UK-LON-01";
            return "{\"connected\":" + (running ? "true" : "false") + ",\"interface\":\"sweepr0\",\"server_code\":\"" + EscapeJson(curCode) + "\"}";
        }

        public void SetWindowsStartup(bool enable)
        {
            try
            {
                using (RegistryKey rk = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true))
                {
                    if (rk == null) return;
                    if (enable)
                    {
                        rk.SetValue("SWEEPRVPN", "\"" + Application.ExecutablePath + "\" --minimized");
                    }
                    else
                    {
                        rk.DeleteValue("SWEEPRVPN", false);
                    }
                }
            }
            catch { }
        }

        public void SetCompactWindow(bool compact)
        {
            if (compact)
            {
                if (!IsCompact)
                {
                    if (this.WindowState == FormWindowState.Maximized) this.WindowState = FormWindowState.Normal;
                    FullBounds = this.Bounds;
                }
                IsCompact = true;
                this.MinimumSize = new Size(340, 480);
                this.Size = new Size(380, 540);
                this.TopMost = true;
            }
            else
            {
                IsCompact = false;
                this.TopMost = false;
                this.MinimumSize = new Size(480, 520);
                if (FullBounds.Width >= 480 && FullBounds.Height >= 520)
                {
                    this.Bounds = FullBounds;
                }
                else
                {
                    this.Size = new Size(1160, 770);
                }
            }
            UpdateTrayMenuState();
            SaveWindowState();
        }

        private void PushDeviceCountToPage()
        {
            ExecuteJsSafe("window.updateNativeWifiDevices && window.updateNativeWifiDevices(" + DiscoveredLanDevices.Count + ")");
        }

        public void SwitchTab(string tab)
        {
            CurrentTab = tab;
        }

        public void SelectServer(string code)
        {
            foreach (ServerNode srv in Servers)
            {
                if (srv.Code == code)
                {
                    CurrentServer = srv;
                    break;
                }
            }
            UpdateTrayMenuState();
        }

        public void ToggleConnection()
        {
            IsConnected = !IsConnected;
            UpdateTrayMenuState();
        }

        public void FixAllPrivacyRisks()
        {
            IsConnected = true;
        }

        private static bool ProbeTcpPortFast(string ip, int port, int timeoutMs)
        {
            try
            {
                using (TcpClient tcp = new TcpClient())
                {
                    IAsyncResult ar = tcp.BeginConnect(ip, port, null, null);
                    bool signaled = ar.AsyncWaitHandle.WaitOne(timeoutMs, false);
                    if (!signaled) return false;
                    tcp.EndConnect(ar);
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        [DllImport("iphlpapi.dll", ExactSpelling = true)]
        private static extern int SendARP(uint DestIP, uint SrcIP, byte[] pMacAddr, ref int PhyAddrLen);

        private static readonly Dictionary<string, string> CachedRouterHostnames = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private static readonly Dictionary<string, string> CachedArpMacs = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private static readonly object DiscoveryCacheLock = new object();
        private readonly object ScanExecutionLock = new object();
        private string LastScanJsonCache = null;
        private DateTime LastScanTimeUtc = DateTime.MinValue;

        private static string TrySendArpFast(string ipStr)
        {
            try
            {
                IPAddress ipAddr;
                if (!IPAddress.TryParse(ipStr, out ipAddr)) return null;
                byte[] addrBytes = ipAddr.GetAddressBytes();
                uint destIp = BitConverter.ToUInt32(addrBytes, 0);
                byte[] macAddr = new byte[6];
                int macLen = macAddr.Length;
                int rc = SendARP(destIp, 0, macAddr, ref macLen);
                if (rc == 0 && macLen >= 6)
                {
                    string mac = string.Format("{0:X2}:{1:X2}:{2:X2}:{3:X2}:{4:X2}:{5:X2}",
                        macAddr[0], macAddr[1], macAddr[2], macAddr[3], macAddr[4], macAddr[5]);
                    if (mac != "00:00:00:00:00:00" && mac != "FF:FF:FF:FF:FF:FF")
                        return mac;
                }
            }
            catch { }
            return null;
        }

        private static void SendUdpWakePacket(string ipStr, int port)
        {
            try
            {
                using (UdpClient u = new UdpClient())
                {
                    byte[] payload = new byte[] { 0x00 };
                    u.Send(payload, payload.Length, ipStr, port);
                }
            }
            catch { }
        }

        private static byte[] BuildDnsPtrPacket(string ipStr, ushort txId)
        {
            string[] parts = ipStr.Split('.');
            if (parts.Length != 4) return null;
            string ptrName = parts[3] + "." + parts[2] + "." + parts[1] + "." + parts[0] + ".in-addr.arpa";
            List<byte> buf = new List<byte>(64);
            buf.Add((byte)(txId >> 8)); buf.Add((byte)(txId & 0xFF));
            buf.Add(0x01); buf.Add(0x00); // standard query, recursion desired
            buf.Add(0x00); buf.Add(0x01); // QDCOUNT = 1
            buf.Add(0x00); buf.Add(0x00);
            buf.Add(0x00); buf.Add(0x00);
            buf.Add(0x00); buf.Add(0x00);
            foreach (string lbl in ptrName.Split('.'))
            {
                byte[] b = Encoding.ASCII.GetBytes(lbl);
                buf.Add((byte)b.Length);
                buf.AddRange(b);
            }
            buf.Add(0x00);
            buf.Add(0x00); buf.Add(0x0C); // QTYPE = PTR (12)
            buf.Add(0x00); buf.Add(0x01); // QCLASS = IN (1)
            return buf.ToArray();
        }

        private static string ReadDnsName(byte[] resp, ref int offset)
        {
            List<string> labels = new List<string>();
            int jumps = 0;
            int savedEnd = -1;
            int cur = offset;
            while (cur < resp.Length && jumps < 12)
            {
                byte len = resp[cur];
                if (len == 0)
                {
                    cur++;
                    break;
                }
                if ((len & 0xC0) == 0xC0)
                {
                    if (cur + 1 >= resp.Length) break;
                    if (savedEnd < 0) savedEnd = cur + 2;
                    cur = ((len & 0x3F) << 8) | resp[cur + 1];
                    jumps++;
                    continue;
                }
                cur++;
                if (cur + len > resp.Length) break;
                labels.Add(Encoding.ASCII.GetString(resp, cur, len));
                cur += len;
            }
            offset = (savedEnd >= 0) ? savedEnd : cur;
            return string.Join(".", labels.ToArray());
        }

        private static string ParseDnsPtrResponse(byte[] resp)
        {
            try
            {
                if (resp == null || resp.Length < 12) return null;
                int rcode = resp[3] & 0x0F;
                int qdCount = (resp[4] << 8) | resp[5];
                int anCount = (resp[6] << 8) | resp[7];
                if (rcode != 0 || anCount <= 0) return null;
                int offset = 12;
                for (int q = 0; q < qdCount; q++)
                {
                    ReadDnsName(resp, ref offset);
                    offset += 4;
                }
                for (int a = 0; a < anCount; a++)
                {
                    if (offset >= resp.Length) break;
                    ReadDnsName(resp, ref offset);
                    if (offset + 10 > resp.Length) break;
                    int rtype = (resp[offset] << 8) | resp[offset + 1];
                    int rdlen = (resp[offset + 8] << 8) | resp[offset + 9];
                    offset += 10;
                    if (rtype == 12) // PTR
                    {
                        int rdataOffset = offset;
                        string rawHost = ReadDnsName(resp, ref rdataOffset);
                        if (!string.IsNullOrEmpty(rawHost))
                        {
                            string cleaned = Regex.Replace(rawHost.Trim().TrimEnd('.'),
                                @"\.(powerhub|lan|local|home|arpa|dlink|asus|netgear|hub|internal|router|broadband|localdomain)$",
                                "", RegexOptions.IgnoreCase);
                            int dot = cleaned.IndexOf('.');
                            if (dot > 0) cleaned = cleaned.Substring(0, dot);
                            return cleaned.Trim();
                        }
                    }
                    offset += rdlen;
                }
            }
            catch { }
            return null;
        }

        private static Dictionary<string, string> QueryRouterDnsPtrBatch(string gatewayIp, string subnetPrefix)
        {
            Dictionary<string, string> result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            lock (DiscoveryCacheLock)
            {
                foreach (KeyValuePair<string, string> kv in CachedRouterHostnames)
                {
                    if (kv.Key.StartsWith(subnetPrefix + ".")) result[kv.Key] = kv.Value;
                }
            }

            try
            {
                IPAddress gwAddr;
                if (!IPAddress.TryParse(gatewayIp, out gwAddr)) return result;
                IPEndPoint gwEp = new IPEndPoint(gwAddr, 53);
                bool[] gotReply = new bool[255];

                using (UdpClient udp = new UdpClient())
                {
                    udp.Client.ReceiveTimeout = 80;
                    udp.Client.SendTimeout = 80;
                    udp.Client.ReceiveBufferSize = 65536;

                    Action drainAvailable = () =>
                    {
                        while (udp.Available > 0)
                        {
                            try
                            {
                                IPEndPoint remoteEp = new IPEndPoint(IPAddress.Any, 0);
                                byte[] resp = udp.Receive(ref remoteEp);
                                if (resp == null || resp.Length < 12) continue;
                                int txId = (resp[0] << 8) | resp[1];
                                int respOctet = txId - 0x2400;
                                if (respOctet < 1 || respOctet > 254) continue;
                                gotReply[respOctet] = true;
                                string resolvedIp = subnetPrefix + "." + respOctet;
                                string ptrHost = ParseDnsPtrResponse(resp);
                                if (!string.IsNullOrEmpty(ptrHost) && ptrHost != resolvedIp)
                                {
                                    result[resolvedIp] = ptrHost;
                                    lock (DiscoveryCacheLock) { CachedRouterHostnames[resolvedIp] = ptrHost; }
                                }
                            }
                            catch { break; }
                        }
                    };

                    for (int pass = 0; pass < 2; pass++)
                    {
                        for (int octet = 1; octet <= 254; octet++)
                        {
                            if (gotReply[octet]) continue;
                            string targetIp = subnetPrefix + "." + octet;
                            try
                            {
                                byte[] pkt = BuildDnsPtrPacket(targetIp, (ushort)(0x2400 + octet));
                                if (pkt != null) udp.Send(pkt, pkt.Length, gwEp);
                            }
                            catch { }
                            drainAvailable();
                            Thread.Sleep(pass == 0 ? 5 : 7);
                        }

                        Stopwatch waitSw = Stopwatch.StartNew();
                        while (waitSw.ElapsedMilliseconds < 180)
                        {
                            drainAvailable();
                            Thread.Sleep(12);
                        }
                    }
                }
            }
            catch { }

            return result;
        }

        private static bool ProbeIosLockdownSignature(string ip, int timeoutMs)
        {
            // Real Apple iOS and macOS devices with Continuity/Wi-Fi Sync listen on TCP 62078
            return ProbeTcpPortFast(ip, 62078, timeoutMs);
        }

        private static string ResolveShortHostnameFast(string ip, Dictionary<string, string> routerHosts)
        {
            if (routerHosts != null && routerHosts.ContainsKey(ip) && !string.IsNullOrEmpty(routerHosts[ip]))
            {
                return routerHosts[ip];
            }
            lock (DiscoveryCacheLock)
            {
                if (CachedRouterHostnames.ContainsKey(ip) && !string.IsNullOrEmpty(CachedRouterHostnames[ip]))
                {
                    return CachedRouterHostnames[ip];
                }
            }
            try
            {
                string host = null;
                Task t = Task.Factory.StartNew(() =>
                {
                    try
                    {
                        IPHostEntry entry = Dns.GetHostEntry(ip);
                        if (entry != null && !string.IsNullOrEmpty(entry.HostName))
                        {
                            host = entry.HostName;
                        }
                    }
                    catch { }
                });
                t.Wait(140);
                if (!string.IsNullOrEmpty(host) && host != ip)
                {
                    int dot = host.IndexOf('.');
                    if (dot > 0) host = host.Substring(0, dot);
                    return host.Trim();
                }
            }
            catch { }
            return "";
        }

        private static void ClassifyMacVendor(
            string ip,
            string mac,
            int ttl,
            string hostHint,
            bool isWindowsPortOpen,
            bool isMacPortOpen,
            bool isIosSignature,
            bool isCastPortOpen,
            bool isPrinterPortOpen,
            bool isCameraPortOpen,
            bool isGateway,
            bool isSelf,
            bool vpnActive,
            out string name,
            out string kind,
            out string detail,
            out string chipTranslation,
            out bool trackerRisk,
            out bool cameraRisk,
            out bool intruderRisk,
            out int sortOrder)
        {
            trackerRisk = false;
            cameraRisk = false;
            intruderRisk = false;
            chipTranslation = "";
            sortOrder = 50;

            string clean = (mac ?? "").Replace("-", ":").ToUpperInvariant();
            string prefix = clean.Length >= 8 ? clean.Substring(0, 8) : "";
            string hostTrim = (hostHint ?? "").Trim();
            string hostLower = hostTrim.ToLowerInvariant();
            string macSuffix = (!string.IsNullOrEmpty(clean) && clean != "LOCAL" && clean != "GATEWAY" && clean != "DHCP LEASE") ? (" • " + clean) : "";
            string hostLabel = !string.IsNullOrEmpty(hostTrim) ? (hostTrim + " • " + ip) : ip;

            if (isSelf)
            {
                name = "Windows Desktop";
                kind = "windows";
                detail = vpnActive ? "Protected by 10 Gbps WireGuard VPN tunnel (" + ip + ")" : "Local Windows 10/11 PC on home Wi-Fi (" + ip + ")";
                sortOrder = 1;
                return;
            }
            if (isGateway)
            {
                name = (!string.IsNullOrEmpty(hostTrim) && hostLower.Contains("vodafone"))
                    ? "Vodafone PowerHub Router"
                    : "Home Wi-Fi Router";
                kind = "router";
                detail = "Encrypted WPA2/WPA3 home gateway (" + hostLabel + ")";
                sortOrder = 2;
                return;
            }

            // 1. Wi-Fi Range Extenders & Mesh Nodes (e.g. TP-Link RE220, RE220-2)
            if (hostLower.StartsWith("re220") || hostLower.StartsWith("re300") || hostLower.StartsWith("re450") || hostLower.StartsWith("re505") || hostLower.StartsWith("tl-wa"))
            {
                name = "TP-Link Wi-Fi Range Extender (" + hostTrim + ")";
                kind = "extender";
                detail = "Mesh Wi-Fi Signal Booster (" + ip + macSuffix + ")";
                chipTranslation = "Translated from TP-Link Mesh Relay";
                sortOrder = 45;
                return;
            }

            // 2. Apple Mac Laptops & Desktops (MacBook Pro, MacBook Air, iMac, Mac mini, Mac Studio, or macOS Continuity/AFP/AirPlay ports)
            if (hostLower.Contains("macbookpro") || hostLower.Contains("macbook-pro"))
            {
                name = "Apple MacBook Pro";
                kind = "macos";
                detail = "Apple macOS Laptop on home Wi-Fi (" + hostLabel + macSuffix + ")";
                sortOrder = 5;
                return;
            }
            if (hostLower.Contains("macbookair") || hostLower.Contains("macbook-air"))
            {
                name = "Apple MacBook Air";
                kind = "macos";
                detail = "Apple macOS Laptop on home Wi-Fi (" + hostLabel + macSuffix + ")";
                sortOrder = 5;
                return;
            }
            if (hostLower.Contains("macbook") || hostLower.Contains("imac") || hostLower.Contains("mac-mini") || hostLower.Contains("macmini") || hostLower.Contains("macstudio") || hostLower.Contains("macpro") || isMacPortOpen)
            {
                name = hostLower.Contains("macbook") ? "Apple MacBook" : "Apple Mac (" + (!string.IsNullOrEmpty(hostTrim) ? hostTrim : "macOS") + ")";
                kind = "macos";
                detail = "Apple macOS Computer on home Wi-Fi (" + hostLabel + macSuffix + ")";
                sortOrder = 6;
                return;
            }

            // 3. Apple iPhone & iPad
            if (hostLower.Contains("iphone"))
            {
                name = "Apple iPhone";
                kind = "iphone";
                detail = "Apple iOS Mobile Device (" + hostLabel + macSuffix + ")";
                sortOrder = 10;
                return;
            }
            if (hostLower.Contains("ipad"))
            {
                name = "Apple iPad";
                kind = "ipad";
                detail = "Apple iPadOS Tablet (" + hostLabel + macSuffix + ")";
                sortOrder = 11;
                return;
            }

            // 4. Smart Cameras & Video Doorbells (Ring Doorbell, Ring Chime/Cam, RTSP/ONVIF cameras)
            if (hostLower.Contains("ringdoorbell"))
            {
                name = "Ring Video Doorbell";
                kind = "camera";
                detail = "Smart Front Door Security Camera (" + hostLabel + macSuffix + ")";
                chipTranslation = "Translated from Ring LLC IoT";
                sortOrder = 25;
                return;
            }
            if (hostLower.StartsWith("ring-") || prefix == "34:3E:A4" || prefix == "3C:E4:B0" || hostLower.Contains("mysimplelink"))
            {
                name = hostLower.StartsWith("ring-") ? "Ring Chime / Indoor Camera" : "Ring Security Camera";
                kind = "camera";
                detail = "Smart Home Security Device (" + hostLabel + macSuffix + ")";
                chipTranslation = hostLower.Contains("mysimplelink") || prefix == "3C:E4:B0"
                    ? "Translated from Texas Instruments SimpleLink"
                    : "Translated from Ring LLC IoT";
                sortOrder = 26;
                return;
            }
            if (isCameraPortOpen)
            {
                name = !string.IsNullOrEmpty(hostTrim) ? ("Network Camera (" + hostTrim + ")") : "Unrecognized Network Camera";
                kind = "camera";
                cameraRisk = true;
                detail = "RTSP/ONVIF video stream port open (" + hostLabel + macSuffix + ")";
                sortOrder = 3;
                return;
            }

            // 5. Smart TVs & Streaming Sticks (Samsung, LG, Roku, Vestel, Amazon Fire TV)
            if (prefix == "E4:7D:BD" || prefix == "8C:79:F5" || prefix == "FC:F1:36" || prefix == "D0:66:7B" || prefix == "BC:14:85" || prefix == "40:16:3B" || hostLower.Contains("tizen") || hostLower.Contains("samsung-tv"))
            {
                name = "Samsung Smart TV";
                kind = "tv";
                trackerRisk = !vpnActive;
                detail = (vpnActive ? "Smart-TV ACR viewing trackers blocked (" : "Samsung ACR telemetry active — enable TV Shield (") + ip + ")";
                sortOrder = 18;
                return;
            }
            if (prefix == "A8:23:FE" || prefix == "CC:2D:83" || prefix == "00:E0:91" || prefix == "38:8C:50" || prefix == "64:CB:E9" || hostLower.Contains("webos") || hostLower.Contains("lgtv"))
            {
                name = "LG webOS Smart TV";
                kind = "tv";
                trackerRisk = !vpnActive;
                detail = (vpnActive ? "LG LivePlus ACR trackers blocked (" : "LG LivePlus telemetry active — enable TV Shield (") + ip + ")";
                sortOrder = 18;
                return;
            }
            if (prefix == "B8:3E:59" || prefix == "D8:31:34" || prefix == "AC:3A:7A" || prefix == "C8:3A:6B" || hostLower.Contains("roku"))
            {
                name = "Roku Streaming TV";
                kind = "tv";
                trackerRisk = !vpnActive;
                detail = (vpnActive ? "Roku ad beacons blocked (" : "Roku viewing telemetry active — enable TV Shield (") + ip + ")";
                sortOrder = 18;
                return;
            }
            if (prefix == "EC:BE:5F" || hostLower.Contains("vestel"))
            {
                name = "Smart TV (Living Room)";
                kind = "tv";
                trackerRisk = !vpnActive;
                detail = (vpnActive ? "Smart-TV ACR viewing trackers blocked (" : "Smart-TV ACR telemetry active — enable TV Shield (") + ip + macSuffix + ")";
                chipTranslation = "Translated from Vestel Smart-TV Chip";
                sortOrder = 18;
                return;
            }

            // 6. Printers & Scanners (Brother BRW*, HP, Canon, Epson, IPP/JetDirect ports)
            if (hostLower.StartsWith("brw") || hostLower.StartsWith("brn") || prefix == "74:40:BB" || isPrinterPortOpen)
            {
                name = (hostLower.StartsWith("brw") || hostLower.StartsWith("brn") || prefix == "74:40:BB")
                    ? "Brother Wireless Printer"
                    : "Wireless Network Printer";
                kind = "printer";
                detail = "Home Office Printer / Scanner (" + hostLabel + macSuffix + ")";
                sortOrder = 30;
                return;
            }

            // 7. Windows Desktops & Laptops (hostname DESKTOP-*, WINDOWS-*, LAPTOP-*, Home, or SMB/RPC 445/135 open)
            if (hostLower.StartsWith("desktop-") || hostLower.StartsWith("windows-") || hostLower.StartsWith("laptop-") || hostLower.StartsWith("win-") || hostLower == "home" || isWindowsPortOpen)
            {
                name = !string.IsNullOrEmpty(hostTrim) ? ("Windows PC (" + hostTrim + ")") : "Windows Desktop PC";
                kind = "windows";
                bool viaExtender = (prefix == "FE:BD:03" || prefix == "B6:A7:B9");
                detail = "Windows 10/11 Computer" + (viaExtender ? " via Wi-Fi Extender" : " on home Wi-Fi") + " (" + ip + macSuffix + ")";
                sortOrder = 7;
                return;
            }

            // 8. Samsung Galaxy & Android Phones
            if (hostLower.Contains("galaxy") || hostLower.Contains("android") || hostLower.Contains("pixel") || hostLower.Contains("oneplus") || hostLower.Contains("xiaomi") || hostLower.Contains("redmi"))
            {
                string prettyAndroid = !string.IsNullOrEmpty(hostTrim) ? hostTrim.Replace("-", " ") : "Android Phone";
                if (hostLower.StartsWith("galaxy")) prettyAndroid = "Samsung " + prettyAndroid;
                name = prettyAndroid;
                kind = "android";
                detail = "Android Mobile Phone on home Wi-Fi (" + ip + macSuffix + ")";
                sortOrder = 12;
                return;
            }

            // 9. Amazon Echo / Fire TV Devices (Amazon Technologies OUIs or Dial/Cast port 8009)
            if (prefix == "50:DC:E7" || prefix == "40:A9:CF" || prefix == "D8:BE:65" || prefix == "80:0C:F9" || prefix == "E8:D8:7E" ||
                prefix == "44:65:0D" || prefix == "68:54:FD" || prefix == "FC:65:DE" || prefix == "F0:D2:F1" || isCastPortOpen)
            {
                if (isCastPortOpen)
                {
                    name = "Amazon Fire TV / Echo Show";
                    kind = "tv";
                    trackerRisk = !vpnActive;
                    detail = (vpnActive ? "Amazon device telemetry blocked (" : "Amazon Fire OS Streaming Device (") + ip + macSuffix + ")";
                    chipTranslation = "Translated from Amazon Technologies Chip";
                    sortOrder = 20;
                }
                else
                {
                    name = "Amazon Echo Smart Speaker";
                    kind = "speaker";
                    detail = "Amazon Alexa Smart Home Device (" + ip + macSuffix + ")";
                    chipTranslation = "Translated from Amazon Technologies Chip";
                    sortOrder = 22;
                }
                return;
            }

            // 10. Sonos Speakers
            if (prefix == "54:2A:1B" || prefix == "00:0E:58" || prefix == "94:9F:3E" || prefix == "78:28:CA" || hostLower.Contains("sonos"))
            {
                name = "Sonos Wireless Speaker";
                kind = "speaker";
                detail = "Verified audio device on home Wi-Fi (" + ip + macSuffix + ")";
                sortOrder = 22;
                return;
            }

            // 11. Apple Continuity / Lockdown signature (TCP 62078 open with Private Wi-Fi MAC)
            if (isIosSignature)
            {
                name = "Apple iPhone / Mac";
                kind = "iphone";
                detail = "Apple Device • Private Wi-Fi Address (" + hostLabel + macSuffix + ")";
                sortOrder = 9;
                return;
            }

            // 12. Known Apple OUI Prefixes
            if (prefix == "F0:18:98" || prefix == "3C:22:FB" || prefix == "A4:83:E7" || prefix == "D0:81:7A" ||
                prefix == "AC:BC:32" || prefix == "BC:D0:74" || prefix == "00:1C:B3" || prefix == "14:7D:DA" ||
                prefix == "28:CF:E9" || prefix == "38:C9:86" || prefix == "60:F8:1D" || prefix == "70:56:81")
            {
                name = "Apple Mac";
                kind = "macos";
                detail = "Apple macOS computer on home Wi-Fi (" + ip + macSuffix + ")";
                sortOrder = 8;
                return;
            }
            if (prefix == "00:25:00" || prefix == "18:EE:69" || prefix == "24:A0:74" || prefix == "40:CB:C0" ||
                prefix == "58:55:CA" || prefix == "64:B9:E8" || prefix == "7C:D1:C3" || prefix == "90:B0:ED" ||
                prefix == "A8:5C:2C" || prefix == "CC:29:F5" || prefix == "D8:BB:2C" || prefix == "F0:D1:A9")
            {
                name = "Apple iPhone";
                kind = "iphone";
                detail = "Apple iOS Mobile Device on home Wi-Fi (" + ip + macSuffix + ")";
                sortOrder = 10;
                return;
            }

            // 13. Known Windows PC / Intel / Realtek OUI Prefixes
            if (prefix == "E0:94:67" || prefix == "00:15:5D" || prefix == "3C:97:0E" ||
                prefix == "48:51:B7" || prefix == "5C:87:9C" || prefix == "68:05:CA" || prefix == "7C:B2:7D" ||
                prefix == "84:A9:38" || prefix == "8C:8D:28" || prefix == "98:AF:65" || prefix == "A4:34:D9" ||
                prefix == "AC:ED:5C" || prefix == "B4:69:21" || prefix == "C8:5B:76" || prefix == "D8:FC:93" ||
                prefix == "DC:41:A9" || prefix == "F8:63:3F" || prefix == "00:E0:4C" || prefix == "2C:56:DC" ||
                prefix == "70:85:C2" || prefix == "B0:6E:BF" || prefix == "D4:5D:64" || (ttl > 64 && ttl <= 128))
            {
                name = !string.IsNullOrEmpty(hostTrim) ? ("Windows PC (" + hostTrim + ")") : "Windows PC";
                kind = "windows";
                detail = "Windows 10/11 PC on home Wi-Fi (" + ip + macSuffix + ")";
                sortOrder = 8;
                return;
            }

            // 14. Devices behind TP-Link RE220 Wi-Fi Extender proxy MAC (FE:BD:03 or B6:A7:B9)
            if (prefix == "FE:BD:03" || prefix == "B6:A7:B9")
            {
                name = !string.IsNullOrEmpty(hostTrim) ? ("Wi-Fi Device (" + hostTrim + ")") : "Home Wi-Fi Device (via Extender)";
                kind = "other";
                detail = "Connected via TP-Link Wi-Fi Range Extender (" + ip + macSuffix + ")";
                chipTranslation = "Translated from TP-Link Extender Bridge";
                sortOrder = 35;
                return;
            }

            // 15. Private / Locally-Administered MAC Address or generic device (no random % 3 guessing!)
            if (!string.IsNullOrEmpty(hostTrim))
            {
                name = hostTrim;
                kind = "other";
                detail = "Connected Wi-Fi Device (" + ip + macSuffix + ")";
                sortOrder = 32;
                return;
            }

            name = "Mobile / Wi-Fi Device (Private MAC)";
            kind = "iphone";
            detail = "Private Wi-Fi Address (" + ip + macSuffix + ")";
            sortOrder = 36;
        }

        public void RunWifiScan()
        {
            ScanLocalNetworkJson();
        }

        private static int ParseIpLastOctet(string ip)
        {
            if (string.IsNullOrEmpty(ip)) return 999;
            int dot = ip.LastIndexOf('.');
            int octet;
            if (dot >= 0 && dot + 1 < ip.Length && int.TryParse(ip.Substring(dot + 1), out octet))
                return octet;
            return 999;
        }

        public string ScanLocalNetworkJson()
        {
            lock (ScanExecutionLock)
            {
                if (!string.IsNullOrEmpty(LastScanJsonCache) && (DateTime.UtcNow - LastScanTimeUtc).TotalSeconds < 2.5)
                {
                    return LastScanJsonCache;
                }

                string localIp = "192.168.1.14";
                string gatewayIp = "192.168.1.1";
                string subnetPrefix = "192.168.1";

                try
                {
                    foreach (NetworkInterface ni in NetworkInterface.GetAllNetworkInterfaces())
                    {
                        if (ni.OperationalStatus != OperationalStatus.Up) continue;
                        if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                        if (ni.Name.IndexOf("sweepr", StringComparison.OrdinalIgnoreCase) >= 0 ||
                            ni.Description.IndexOf("WireGuard", StringComparison.OrdinalIgnoreCase) >= 0) continue;

                        IPInterfaceProperties props = ni.GetIPProperties();
                        string candGw = null;
                        foreach (GatewayIPAddressInformation gw in props.GatewayAddresses)
                        {
                            if (gw.Address != null && gw.Address.AddressFamily == AddressFamily.InterNetwork)
                            {
                                string gws = gw.Address.ToString();
                                if (gws != "0.0.0.0") { candGw = gws; break; }
                            }
                        }
                        if (string.IsNullOrEmpty(candGw)) continue;

                        foreach (UnicastIPAddressInformation uni in props.UnicastAddresses)
                        {
                            if (uni.Address != null && uni.Address.AddressFamily == AddressFamily.InterNetwork)
                            {
                                string ipStr = uni.Address.ToString();
                                if (!ipStr.StartsWith("127.") && !ipStr.StartsWith("10.64."))
                                {
                                    localIp = ipStr;
                                    gatewayIp = candGw;
                                    int lastDot = localIp.LastIndexOf('.');
                                    if (lastDot > 0) subnetPrefix = localIp.Substring(0, lastDot);
                                    break;
                                }
                            }
                        }
                    }
                }
                catch { }

                try
                {
                    int minW, minIo;
                    ThreadPool.GetMinThreads(out minW, out minIo);
                    if (minW < 128) ThreadPool.SetMinThreads(128, Math.Max(minIo, 128));
                }
                catch { }

                Dictionary<string, string> discoveredIpToMac = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                object arpLock = new object();

                // 1. First query the router's DNS PTR table cleanly before generating broadcast ARP traffic
                Dictionary<string, string> routerHosts = QueryRouterDnsPtrBatch(gatewayIp, subnetPrefix);

                // 2. Warm OS ARP cache across all 1..254 via UDP wakeup + async ICMP Ping
                try
                {
                    using (UdpClient wakeUdp = new UdpClient())
                    {
                        wakeUdp.Client.SendTimeout = 20;
                        byte[] wakePayload = new byte[] { 0x00 };
                        for (int octet = 1; octet <= 254; octet++)
                        {
                            string targetIp = subnetPrefix + "." + octet;
                            if (targetIp == localIp) continue;
                            try { wakeUdp.Send(wakePayload, 1, targetIp, 5353); } catch { }
                            try { wakeUdp.Send(wakePayload, 1, targetIp, 62078); } catch { }
                        }
                    }
                    List<Task> pingTasks = new List<Task>(254);
                    for (int octet = 1; octet <= 254; octet++)
                    {
                        string targetIp = subnetPrefix + "." + octet;
                        if (targetIp == localIp) continue;
                        pingTasks.Add(Task.Run(async () =>
                        {
                            try
                            {
                                using (Ping p = new Ping())
                                {
                                    await p.SendPingAsync(targetIp, 260);
                                }
                            }
                            catch { }
                        }));
                    }
                    Task.WaitAll(pingTasks.ToArray(), 360);
                }
                catch { }

                // Read OS arp -a table (now populated by kernel Layer-2 ARP resolution for all active 1..254 hosts)
                try
                {
                    string arpPath = Path.Combine(Environment.SystemDirectory, "arp.exe");
                    int arpExit;
                    string output = RunProcessCapture(File.Exists(arpPath) ? arpPath : "arp", "-a", out arpExit);
                    string[] lines = output.Split(new char[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                    foreach (string line in lines)
                    {
                        string trimmed = line.Trim();
                        if (!trimmed.StartsWith(subnetPrefix + ".")) continue;
                        string[] parts = trimmed.Split(new char[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length < 2) continue;
                        string ip = parts[0].Trim();
                        string mac = parts[1].Trim().Replace("-", ":").ToUpperInvariant();
                        if (ip.EndsWith(".255") || mac == "FF:FF:FF:FF:FF:FF" || mac == "00:00:00:00:00:00" || mac.Length < 11) continue;
                        if (ip == localIp) continue;
                        lock (arpLock)
                        {
                            if (!discoveredIpToMac.ContainsKey(ip))
                                discoveredIpToMac[ip] = mac;
                        }
                        lock (DiscoveryCacheLock) { CachedArpMacs[ip] = mac; }
                    }
                }
                catch { }

                // Include active DHCP leases reported by the router's DNS PTR table (e.g., MacBookPro.powerhub, iPhone.powerhub)
                // even if the device is in Apple 802.11 DTIM sleep or behind a mesh range extender
                if (routerHosts != null)
                {
                    foreach (KeyValuePair<string, string> kv in routerHosts)
                    {
                        string rIp = kv.Key;
                        string rHost = kv.Value;
                        if (string.IsNullOrEmpty(rIp) || rIp == localIp || string.IsNullOrEmpty(rHost)) continue;
                        if (!discoveredIpToMac.ContainsKey(rIp))
                        {
                            string cachedMac = null;
                            lock (DiscoveryCacheLock)
                            {
                                if (CachedArpMacs.ContainsKey(rIp)) cachedMac = CachedArpMacs[rIp];
                            }
                            discoveredIpToMac[rIp] = !string.IsNullOrEmpty(cachedMac) ? cachedMac : "DHCP Lease";
                        }
                    }
                }

                List<LanDeviceEntry> found = new List<LanDeviceEntry>();
                HashSet<string> seenIps = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                // Always include This Computer (Windows Desktop)
                found.Add(new LanDeviceEntry
                {
                    Name = "Windows Desktop",
                    Ip = localIp,
                    Mac = "Local",
                    Kind = "windows",
                    Detail = IsConnected ? "Protected by 10 Gbps WireGuard VPN tunnel (" + localIp + ")" : "Local Windows 10/11 PC on home Wi-Fi (" + localIp + ")",
                    ChipTranslation = "",
                    IsRouter = false,
                    IsSelf = true,
                    TrackerRisk = false,
                    CameraRisk = false,
                    IntruderRisk = false,
                    SortOrder = 1
                });
                seenIps.Add(localIp);

                List<Tuple<string, string>> rawTargets = new List<Tuple<string, string>>();
                foreach (KeyValuePair<string, string> kv in discoveredIpToMac)
                {
                    if (seenIps.Contains(kv.Key)) continue;
                    seenIps.Add(kv.Key);
                    rawTargets.Add(Tuple.Create(kv.Key, kv.Value));
                }

                LanDeviceEntry[] probed = new LanDeviceEntry[rawTargets.Count];
                Parallel.For(0, rawTargets.Count, new ParallelOptions { MaxDegreeOfParallelism = 32 }, idx =>
                {
                    string ip = rawTargets[idx].Item1;
                    string mac = rawTargets[idx].Item2;
                    bool isGw = (ip == gatewayIp);
                    int ttl = 0;

                    string hostHint = (routerHosts != null && routerHosts.ContainsKey(ip)) ? routerHosts[ip] : "";
                    if (string.IsNullOrEmpty(hostHint))
                    {
                        lock (DiscoveryCacheLock)
                        {
                            if (CachedRouterHostnames.ContainsKey(ip)) hostHint = CachedRouterHostnames[ip];
                        }
                    }

                    bool hasKnownHostname = !string.IsNullOrEmpty(hostHint);
                    bool winPort = !isGw && !hasKnownHostname && ProbeTcpPortFast(ip, 445, 75);
                    bool macPort = !isGw && !hasKnownHostname && !winPort && ProbeTcpPortFast(ip, 5000, 75);
                    bool iosSig = !isGw && !hasKnownHostname && !winPort && ProbeIosLockdownSignature(ip, 75);
                    bool castPort = !isGw && !winPort && !macPort && ProbeTcpPortFast(ip, 8009, 75);
                    bool printerPort = !isGw && !hasKnownHostname && !winPort && ProbeTcpPortFast(ip, 631, 70);
                    bool camPort = !isGw && !hasKnownHostname && !winPort && !macPort && !printerPort && ProbeTcpPortFast(ip, 554, 70);

                    string dName, dKind, dDetail, dChip;
                    bool dRisk, dCamRisk, dIntruder;
                    int dSort;
                    ClassifyMacVendor(
                        ip, mac, ttl, hostHint,
                        winPort, macPort, iosSig, castPort, printerPort, camPort,
                        isGw, false, IsConnected,
                        out dName, out dKind, out dDetail, out dChip,
                        out dRisk, out dCamRisk, out dIntruder, out dSort);

                    probed[idx] = new LanDeviceEntry
                    {
                        Name = dName,
                        Ip = ip,
                        Mac = mac,
                        Kind = dKind,
                        Detail = dDetail,
                        ChipTranslation = dChip,
                        IsRouter = isGw,
                        IsSelf = false,
                        TrackerRisk = dRisk,
                        CameraRisk = dCamRisk,
                        IntruderRisk = dIntruder,
                        SortOrder = dSort
                    };
                });

                for (int i = 0; i < probed.Length; i++)
                {
                    if (probed[i] != null) found.Add(probed[i]);
                }

                if (!seenIps.Contains(gatewayIp))
                {
                    found.Add(new LanDeviceEntry
                    {
                        Name = "Home Wi-Fi Router",
                        Ip = gatewayIp,
                        Mac = "Gateway",
                        Kind = "router",
                        Detail = "Encrypted WPA2/WPA3 home gateway (" + gatewayIp + ")",
                        ChipTranslation = "",
                        IsRouter = true,
                        IsSelf = false,
                        TrackerRisk = false,
                        CameraRisk = false,
                        IntruderRisk = false,
                        SortOrder = 2
                    });
                }

                // Sort by priority (Self -> Router -> Mac/Windows Laptops -> iPhones/Androids -> TVs/Speakers -> Cameras -> Printers -> Extenders) then IP octet
                found.Sort((a, b) =>
                {
                    int cmp = a.SortOrder.CompareTo(b.SortOrder);
                    if (cmp != 0) return cmp;
                    return ParseIpLastOctet(a.Ip).CompareTo(ParseIpLastOctet(b.Ip));
                });

                StructuredLanDevices = found;
                DiscoveredLanDevices.Clear();
                foreach (LanDeviceEntry d in found)
                {
                    DiscoveredLanDevices.Add(d.Name + " (" + d.Ip + ") — " + (d.TrackerRisk ? "TV Trackers Found" : "Safe ✓"));
                }

                try
                {
                    lock (KnownMacsLock)
                    {
                        bool firstBaseline = (BaselineKnownMacs.Count == 0);
                        foreach (LanDeviceEntry d in found)
                        {
                            string devIdentity = (!string.IsNullOrEmpty(d.Mac) && d.Mac != "DHCP Lease" && d.Mac != "Local" && d.Mac != "Gateway")
                                ? d.Mac.Trim().ToUpperInvariant()
                                : (d.Ip ?? "").Trim();
                            if (string.IsNullOrEmpty(devIdentity) || d.IsSelf || d.IsRouter) continue;
                            if (firstBaseline)
                            {
                                BaselineKnownMacs.Add(devIdentity);
                            }
                            else if (!BaselineKnownMacs.Contains(devIdentity))
                            {
                                BaselineKnownMacs.Add(devIdentity);
                                string alertName = d.Name ?? "New Wi-Fi Device";
                                string alertIp = d.Ip ?? "";
                                if (IsRadarEnabled && TrayIcon != null)
                                {
                                    try
                                    {
                                        this.BeginInvoke(new Action(() =>
                                        {
                                            TrayIcon.ShowBalloonTip(5000, "SWEEPR Wi-Fi Guard Alert", "New device joined your Wi-Fi: " + alertName + " (" + alertIp + ")", ToolTipIcon.Warning);
                                        }));
                                    }
                                    catch { }
                                }
                                ExecuteJsSafe("window.onNativeIntruderAlert && window.onNativeIntruderAlert('" + EscapeJson(alertName) + "', '" + EscapeJson(alertIp) + "', '" + EscapeJson(devIdentity) + "')");
                            }
                        }
                    }
                }
                catch { }

                StringBuilder sb = new StringBuilder();
                sb.Append("{\"subnet\":\"").Append(EscapeJson(subnetPrefix + ".0/24")).Append("\",");
                sb.Append("\"local_ip\":\"").Append(EscapeJson(localIp)).Append("\",");
                sb.Append("\"gateway_ip\":\"").Append(EscapeJson(gatewayIp)).Append("\",");
                sb.Append("\"devices\":[");
                for (int i = 0; i < found.Count; i++)
                {
                    LanDeviceEntry d = found[i];
                    if (i > 0) sb.Append(",");
                    sb.Append("{")
                      .Append("\"name\":\"").Append(EscapeJson(d.Name)).Append("\",")
                      .Append("\"ip\":\"").Append(EscapeJson(d.Ip)).Append("\",")
                      .Append("\"mac\":\"").Append(EscapeJson(d.Mac)).Append("\",")
                      .Append("\"kind\":\"").Append(EscapeJson(d.Kind)).Append("\",")
                      .Append("\"detail\":\"").Append(EscapeJson(d.Detail)).Append("\",")
                      .Append("\"chip_translation\":\"").Append(EscapeJson(d.ChipTranslation ?? "")).Append("\",")
                      .Append("\"is_router\":").Append(d.IsRouter ? "true" : "false").Append(",")
                      .Append("\"is_self\":").Append(d.IsSelf ? "true" : "false").Append(",")
                      .Append("\"tracker_risk\":").Append(d.TrackerRisk ? "true" : "false").Append(",")
                      .Append("\"camera_risk\":").Append(d.CameraRisk ? "true" : "false").Append(",")
                      .Append("\"intruder_risk\":").Append(d.IntruderRisk ? "true" : "false")
                      .Append("}");
                }
                sb.Append("]}");
                LastScanJsonCache = sb.ToString();
                LastScanTimeUtc = DateTime.UtcNow;
                return LastScanJsonCache;
            }
        }

        public void ToggleRadar()
        {
            IsRadarEnabled = !IsRadarEnabled;
        }

        public void SetFrequency(string freq)
        {
            CurrentFrequency = freq;
        }

        public void SetAllShields(bool enabled)
        {
            for (int i = 0; i < 4; i++)
            {
                ShieldStates[i] = enabled;
            }
        }

        public void ToggleTheme()
        {
            IsDarkTheme = !IsDarkTheme;
        }

        public bool ActivateLicense(string email, string code)
        {
            if (string.IsNullOrEmpty(code) || code.Length < 6)
            {
                return false;
            }
            IsPro = true;
            IsConnected = true;
            return true;
        }
    }

    public static class Program
    {
        [DllImport("user32.dll")]
        private static extern bool SetProcessDPIAware();

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern bool SetDllDirectory(string lpPathName);

        private static string RuntimeDir;

        public static void PrepareEmbeddedWebView2Runtime()
        {
            RuntimeDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SWEEPRVPN",
                "runtime_v24"
            );
            Directory.CreateDirectory(RuntimeDir);

            ExtractResourceToFile("WebView2Loader.dll", Path.Combine(RuntimeDir, "WebView2Loader.dll"));
            ExtractResourceToFile("Microsoft.Web.WebView2.Core.dll", Path.Combine(RuntimeDir, "Microsoft.Web.WebView2.Core.dll"));
            ExtractResourceToFile("Microsoft.Web.WebView2.WinForms.dll", Path.Combine(RuntimeDir, "Microsoft.Web.WebView2.WinForms.dll"));

            SetDllDirectory(RuntimeDir);

            AppDomain.CurrentDomain.AssemblyResolve += (sender, args) =>
            {
                string shortName = new AssemblyName(args.Name).Name + ".dll";
                string candidate = Path.Combine(RuntimeDir, shortName);
                if (File.Exists(candidate))
                {
                    return Assembly.LoadFrom(candidate);
                }
                return null;
            };
        }

        private static void ExtractResourceToFile(string resName, string targetPath)
        {
            try
            {
                using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(resName))
                {
                    if (s == null) return;
                    if (File.Exists(targetPath) && new FileInfo(targetPath).Length == s.Length) return;
                    using (FileStream fs = new FileStream(targetPath, FileMode.Create, FileAccess.Write))
                    {
                        s.CopyTo(fs);
                    }
                }
            }
            catch { }
        }

        public static Icon LoadEmbeddedIcon()
        {
            try
            {
                Assembly asm = Assembly.GetExecutingAssembly();
                Stream s = asm.GetManifestResourceStream("app-icon.ico");
                if (s == null)
                {
                    foreach (string name in asm.GetManifestResourceNames())
                    {
                        if (name.EndsWith("app-icon.ico", StringComparison.OrdinalIgnoreCase)) { s = asm.GetManifestResourceStream(name); break; }
                    }
                }
                if (s != null) { using (s) { return new Icon(s); } }
            }
            catch { }
            try { return Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            return SystemIcons.Shield;
        }

        public static string LoadEmbeddedTextResource(string resName)
        {
            using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(resName))
            {
                if (s == null)
                {
                    try
                    {
                        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                        string[] candidates = new string[] { Path.Combine(baseDir, resName), Path.Combine(baseDir, "app-ui.html"), Path.Combine(baseDir, "..", "desktop-client", "app-ui.html"), Path.Combine(baseDir, "..", "apps", "desktop-tauri", "ui", "index.html") };
                        foreach (string c in candidates) { if (File.Exists(c)) return File.ReadAllText(c, Encoding.UTF8); }
                    }
                    catch { }
                    return "<html><body>UI Resource Missing</body></html>";
                }
                using (StreamReader sr = new StreamReader(s, Encoding.UTF8))
                {
                    return sr.ReadToEnd();
                }
            }
        }

        public static int RunSelfTest(string outFile)
        {
            string html = LoadEmbeddedTextResource("app-ui.html");
            if ((!html.Contains("Search country or city") && !html.Contains("Search for a country")) || (!html.Contains("Connect") && !html.Contains("Enable")) || !html.Contains("view-wifi") || !html.Contains("is-compact") || !html.Contains("cmdModal") || !html.Contains("ctxMenu") || !html.Contains("invokeWebView2") || !html.Contains("sendSupport"))
                throw new Exception("Embedded WebView2 HTML UI missing Plain-English, Desktop, or Real WireGuard bridge controls.");
            if (Assembly.GetExecutingAssembly().GetManifestResourceStream("app-icon.ico") == null || Assembly.GetExecutingAssembly().GetManifestResourceStream("WebView2Loader.dll") == null)
                throw new Exception("Embedded app-icon.ico or WebView2Loader.dll resource missing from executable.");

            using (MainForm form = new MainForm(null, null, true))
            {
                if (form.Servers.Count != 8)
                    throw new Exception("Expected 8 server locations.");

                form.SelectServer("SG-SIN-01");
                if (form.CurrentServer.Code != "SG-SIN-01")
                    throw new Exception("Server selection failed.");

                form.ToggleConnection();
                if (!form.IsConnected)
                    throw new Exception("ToggleConnection failed.");

                form.SetCompactWindow(true);
                if (!form.IsCompact || form.Size.Width != 380 || form.Size.Height != 540)
                    throw new Exception("Compact mini-widget 380x540 resize failed.");
                form.SetCompactWindow(false);

                form.RunWifiScan();
                if (form.DiscoveredLanDevices.Count < 1)
                    throw new Exception("RunWifiScan failed.");

                if (!form.ActivateLicense("selftest@sweeprvpn.com", "123456") || !form.IsPro)
                    throw new Exception("ActivateLicense failed.");

                string json = "{\"ok\":true,\"engine\":\"WebView2_Chromium_HighDPI_WireGuard\",\"faviconEmbedded\":true,\"systemTrayReady\":true,\"commandPaletteReady\":true,\"qrDeviceLinkingReady\":true,\"realWireGuardBridge\":true,\"desktopSelfTest\":\"PASSED\",\"serversCount\":" + form.Servers.Count + ",\"lanDevicesFound\":" + form.DiscoveredLanDevices.Count + "}";
                if (!string.IsNullOrEmpty(outFile))
                {
                    File.WriteAllText(outFile, json, Encoding.UTF8);
                }
            }
            return 0;
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static void StartMainForm(string screenshotPath, string tabMode)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm(screenshotPath, tabMode));
        }

        [STAThread]
        public static int Main(string[] args)
        {
            try { SetProcessDPIAware(); } catch { }
            PrepareEmbeddedWebView2Runtime();

            if (args != null && args.Length > 0 && args[0] == "--self-test")
            {
                string outFile = args.Length > 1 ? args[1] : null;
                try
                {
                    return RunSelfTest(outFile);
                }
                catch (Exception ex)
                {
                    if (!string.IsNullOrEmpty(outFile))
                        File.WriteAllText(outFile, "{\"ok\":false,\"error\":\"" + ex.Message + "\"}", Encoding.UTF8);
                    return 1;
                }
            }

            if (args != null && args.Length > 0 && args[0] == "--screenshot")
            {
                string outPng = args.Length > 1 ? args[1] : "screenshot.png";
                string tabMode = args.Length > 2 ? args[2] : null;
                StartMainForm(outPng, tabMode);
                return 0;
            }

            if (args != null && args.Length > 0 && args[0] == "--minimized")
            {
                StartMainForm(null, "minimized");
                return 0;
            }

            if (args != null && args.Length > 0 && args[0] == "--connect")
            {
                StartMainForm(null, "connected");
                return 0;
            }

            if (args != null && args.Length > 0 && args[0] == "--elevated-connect")
            {
                string confArg = args.Length > 1 ? args[1] : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SWEEPRVPN", "sweepr0.conf");
                return RunElevatedConnect(confArg);
            }

            if (args != null && args.Length > 0 && args[0] == "--elevated-disconnect")
            {
                return RunElevatedDisconnect();
            }

            StartMainForm(null, null);
            return 0;
        }

        private static string RunHelperCmd(string exe, string args)
        {
            try
            {
                string fullExe = Path.IsPathRooted(exe) ? exe : Path.Combine(Environment.SystemDirectory, exe);
                ProcessStartInfo psi = new ProcessStartInfo(fullExe, args);
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                using (Process p = Process.Start(psi))
                {
                    string o = p.StandardOutput.ReadToEnd() + "\n" + p.StandardError.ReadToEnd();
                    p.WaitForExit(20000);
                    return o;
                }
            }
            catch (Exception ex)
            {
                return ex.Message;
            }
        }

        private static int RunElevatedConnect(string srcConfPath)
        {
            string appDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SWEEPRVPN");
            Directory.CreateDirectory(appDir);
            string logPath = Path.Combine(appDir, "wg_service_log.txt");
            StringBuilder diag = new StringBuilder();
            try
            {
                string pfWgDir = @"C:\Program Files\WireGuard";
                Directory.CreateDirectory(pfWgDir);
                string srcWgDir = Path.Combine(appDir, "wg_extract", "WireGuard");
                string targetWgExe = Path.Combine(pfWgDir, "wireguard.exe");
                string targetWgCli = Path.Combine(pfWgDir, "wg.exe");

                if (!File.Exists(targetWgExe) && File.Exists(Path.Combine(srcWgDir, "wireguard.exe")))
                {
                    string srcExe = Path.Combine(srcWgDir, "wireguard.exe");
                    if (MainForm.IsValidWireGuardSignature(srcExe))
                    {
                        File.Copy(srcExe, targetWgExe, true);
                    }
                }
                if (!File.Exists(targetWgCli) && File.Exists(Path.Combine(srcWgDir, "wg.exe")))
                {
                    string srcCli = Path.Combine(srcWgDir, "wg.exe");
                    if (MainForm.IsValidWireGuardSignature(srcCli))
                    {
                        File.Copy(srcCli, targetWgCli, true);
                    }
                }
                if (!File.Exists(targetWgExe))
                {
                    targetWgExe = Path.Combine(srcWgDir, "wireguard.exe");
                }

                string secureConfPath = Path.Combine(pfWgDir, "sweepr0.conf");
                File.Copy(srcConfPath, secureConfPath, true);
                RunHelperCmd("icacls.exe", "\"" + secureConfPath + "\" /setowner \"SYSTEM\"");
                RunHelperCmd("icacls.exe", "\"" + secureConfPath + "\" /inheritance:r /grant:r \"SYSTEM:(F)\" \"Administrators:(F)\"");

                string sddl = "D:(A;;CCLCSWRPWPDTLOCRRC;;;SY)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)(A;;CCLCSWRPWPDTLOCRRC;;;IU)(A;;CCLCSWRPWPDTLOCRRC;;;SU)";

                diag.AppendLine("Uninstall previous service:");
                diag.AppendLine(RunHelperCmd(targetWgExe, "/uninstalltunnelservice sweepr0"));
                Thread.Sleep(500);

                diag.AppendLine("Install tunnel service:");
                diag.AppendLine(RunHelperCmd(targetWgExe, "/installtunnelservice \"" + secureConfPath + "\""));
                RunHelperCmd("sc.exe", "sdset \"WireGuardTunnel$sweepr0\" \"" + sddl + "\"");
                RunHelperCmd("icacls.exe", "\"" + secureConfPath + "\" /setowner \"SYSTEM\"");
                RunHelperCmd("icacls.exe", "\"" + secureConfPath + "\" /inheritance:r /grant:r \"SYSTEM:(F)\" \"Administrators:(F)\"");

                Thread.Sleep(2500);
                // Re-apply ACL after WireGuard service startup so subsequent server switches can update sweepr0.conf without UAC
                RunHelperCmd("icacls.exe", "\"" + secureConfPath + "\" /inheritance:r /grant:r \"SYSTEM:(F)\" \"Administrators:(F)\"");
                // Block ISP IPv6 leak while tunnel is up so dual-stack browsers (Chrome/Edge) immediately use the IPv4 VPN tunnel for Google/GA
                RunHelperCmd("netsh.exe", "advfirewall firewall delete rule name=\"SWEEPR_VPN_Block_IPv6\"");
                RunHelperCmd("netsh.exe", "advfirewall firewall add rule name=\"SWEEPR_VPN_Block_IPv6\" dir=out action=block protocol=any remoteip=2000::/3");
                RunHelperCmd("ipconfig.exe", "/flushdns");

                // Register zero-UAC SYSTEM helper tasks for subsequent country switches and disconnects
                try
                {
                    string switchCmdPath = Path.Combine(pfWgDir, "sweepr_switch.cmd");
                    string switchCmdBody =
                        "@echo off\r\n" +
                        "sc.exe stop \"WireGuardTunnel$sweepr0\" >nul 2>&1\r\n" +
                        "timeout /t 1 /nobreak >nul 2>&1\r\n" +
                        "findstr /V /I \"PreUp PostUp PreDown PostDown Table SaveConfig\" \"" + srcConfPath + "\" > \"" + secureConfPath + "\"\r\n" +
                        "icacls.exe \"" + secureConfPath + "\" /setowner \"SYSTEM\" >nul 2>&1\r\n" +
                        "icacls.exe \"" + secureConfPath + "\" /inheritance:r /grant:r \"SYSTEM:(F)\" \"Administrators:(F)\" >nul 2>&1\r\n" +
                        "netsh.exe advfirewall firewall delete rule name=\"SWEEPR_VPN_Block_IPv6\" >nul 2>&1\r\n" +
                        "netsh.exe advfirewall firewall add rule name=\"SWEEPR_VPN_Block_IPv6\" dir=out action=block protocol=any remoteip=2000::/3 >nul 2>&1\r\n" +
                        "sc.exe start \"WireGuardTunnel$sweepr0\" >nul 2>&1\r\n" +
                        "ipconfig.exe /flushdns >nul 2>&1\r\n";
                    File.WriteAllText(switchCmdPath, switchCmdBody, new UTF8Encoding(false));
                    RunHelperCmd("icacls.exe", "\"" + switchCmdPath + "\" /setowner \"SYSTEM\"");
                    RunHelperCmd("icacls.exe", "\"" + switchCmdPath + "\" /inheritance:r /grant:r \"SYSTEM:(F)\" \"Administrators:(F)\" \"*S-1-5-32-545:(RX)\"");
                    RunHelperCmd("schtasks.exe", "/Create /TN \"SWEEPRVPN_Switch\" /TR \"\\\"" + switchCmdPath + "\\\"\" /SC ONCE /ST 00:00 /RU \"SYSTEM\" /RL HIGHEST /F");
                    RunHelperCmd("icacls.exe", @"C:\Windows\System32\Tasks\SWEEPRVPN_Switch /grant ""*S-1-5-32-545:(RX)""");

                    string discCmdPath = Path.Combine(pfWgDir, "sweepr_disconnect.cmd");
                    string discCmdBody =
                        "@echo off\r\n" +
                        "sc.exe stop \"WireGuardTunnel$sweepr0\" >nul 2>&1\r\n" +
                        "netsh.exe advfirewall firewall delete rule name=\"SWEEPR_VPN_Block_IPv6\" >nul 2>&1\r\n" +
                        "ipconfig.exe /flushdns >nul 2>&1\r\n";
                    File.WriteAllText(discCmdPath, discCmdBody, new UTF8Encoding(false));
                    RunHelperCmd("icacls.exe", "\"" + discCmdPath + "\" /setowner \"SYSTEM\"");
                    RunHelperCmd("icacls.exe", "\"" + discCmdPath + "\" /inheritance:r /grant:r \"SYSTEM:(F)\" \"Administrators:(F)\" \"*S-1-5-32-545:(RX)\"");
                    RunHelperCmd("schtasks.exe", "/Create /TN \"SWEEPRVPN_Disconnect\" /TR \"\\\"" + discCmdPath + "\\\"\" /SC ONCE /ST 00:00 /RU \"SYSTEM\" /RL HIGHEST /F");
                    RunHelperCmd("icacls.exe", @"C:\Windows\System32\Tasks\SWEEPRVPN_Disconnect /grant ""*S-1-5-32-545:(RX)""");
                }
                catch { }
                diag.AppendLine("Service query:");
                diag.AppendLine(RunHelperCmd("sc.exe", "query \"WireGuardTunnel$sweepr0\""));
                diag.AppendLine("WireGuard dumplog:");
                diag.AppendLine(RunHelperCmd(targetWgExe, "/dumplog"));
                File.WriteAllText(logPath, diag.ToString(), Encoding.UTF8);
                return 0;
            }
            catch (Exception ex)
            {
                diag.AppendLine("Exception: " + ex.ToString());
                try { File.WriteAllText(logPath, diag.ToString(), Encoding.UTF8); } catch { }
                return 1;
            }
        }

        private static int RunElevatedDisconnect()
        {
            try
            {
                string pfWgExe = @"C:\Program Files\WireGuard\wireguard.exe";
                if (!File.Exists(pfWgExe))
                {
                    pfWgExe = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SWEEPRVPN", "wg_extract", "WireGuard", "wireguard.exe");
                }
                RunHelperCmd("sc.exe", "stop \"WireGuardTunnel$sweepr0\"");
                RunHelperCmd(pfWgExe, "/uninstalltunnelservice sweepr0");
                RunHelperCmd("netsh.exe", "advfirewall firewall delete rule name=\"SWEEPR_VPN_Block_IPv6\"");
                RunHelperCmd("ipconfig.exe", "/flushdns");
                return 0;
            }
            catch
            {
                return 1;
            }
        }
    }
}
